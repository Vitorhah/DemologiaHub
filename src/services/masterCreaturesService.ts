import { supabase } from "../lib/supabase";
import type {
  CreatureFolder,
  CreatureRecord,
  CreatureSkillEntry,
  CreatureSummary,
} from "../types/masterCreatures";
import {
  CREATURE_RECORD_PREFIX,
  buildCreatureDescriptionPreview,
  calculateCreatureStats,
  getFallbackCreatureRecordId,
  getFallbackFoldersRecordId,
  normalizeCreatureFolders,
  normalizeCreatureName,
  normalizeCreatureRecord,
  normalizeCreatureSkills,
  sortCreatureSummaries,
  toCreatureSummary,
} from "../utils/masterCreatures";
import { isTableMissingError } from "../utils/masterNotes";
import { normalizeRitualAffiliations } from "../utils/rituals";

type CreatureStorageBackend = "unknown" | "dedicated_tables" | "players_fallback";

let resolvedBackend: CreatureStorageBackend = "unknown";

function isSchemaMissingError(error: unknown): boolean {
  if (isTableMissingError(error)) return true;
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: unknown; message?: unknown };
  const code = typeof err.code === "string" ? err.code : "";
  const msg = typeof err.message === "string" ? err.message.toLowerCase() : "";
  return (
    code === "42703" ||
    code === "PGRST204" ||
    (msg.includes("column") && msg.includes("does not exist")) ||
    msg.includes("schema cache")
  );
}

/**
 * Serviço CRUD sob demanda para Criaturas da Biblioteca do Mestre.
 *
 * Princípios de desempenho e integridade:
 * - Sem Supabase Realtime nem polling em background.
 * - Listagem (`listMasterCreatureSummaries`) projeta APENAS metadados leves
 *   (id, name, folderId, descriptionPreview, hpMax, peMax, smMax, skillsCount, updatedAt)
 *   sem transferir a ficha completa (`description`, `variables`, `skills`) até abrir.
 * - Ficha completa (`getMasterCreatureById`) é consultada sob demanda.
 * - Usa as tabelas dedicadas (`master_creature_folders`, `master_creatures`,
 *   `master_creature_skills` com ON DELETE CASCADE) quando a migração SQL existir;
 *   caso contrário, utiliza automaticamente registros isolados `CREATURE_<id>` e
 *   `CREATURE_FOLDERS_<masterId>` na tabela existente `public.players`.
 * - Excluir uma criatura remove permanentemente sua ficha e suas skills exclusivas,
 *   sem jamais tocar em skills compartilhadas da Biblioteca (`MASTER_LIBRARY`) nem
 *   em instâncias já invocadas na sessão (`EXTRA_FICHA_*`).
 */

export async function listMasterCreatureFolders(
  masterId: string,
): Promise<CreatureFolder[]> {
  if (!masterId) return [];

  if (resolvedBackend !== "players_fallback") {
    const { data, error } = await supabase
      .from("master_creature_folders")
      .select("id, master_id, name, parent_id, created_at, updated_at")
      .eq("master_id", masterId)
      .order("name", { ascending: true });

    if (!error) {
      resolvedBackend = "dedicated_tables";
      return normalizeCreatureFolders(data || [], masterId);
    }

    if (!isTableMissingError(error)) {
      throw new Error(error.message || "Falha ao carregar pastas de criaturas.");
    }
    resolvedBackend = "players_fallback";
  }

  const recordId = getFallbackFoldersRecordId(masterId);
  const { data, error } = await supabase
    .from("players")
    .select("data")
    .eq("id", recordId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Falha ao carregar pastas de criaturas.");
  }

  return normalizeCreatureFolders(data?.data?.folders || [], masterId);
}

export async function saveMasterCreatureFolders(
  masterId: string,
  folders: CreatureFolder[],
): Promise<CreatureFolder[]> {
  if (!masterId) {
    throw new Error("Identificador do Mestre indisponível.");
  }
  const clean = normalizeCreatureFolders(folders, masterId);
  const nowIso = new Date().toISOString();

  if (resolvedBackend !== "players_fallback") {
    const existingRes = await supabase
      .from("master_creature_folders")
      .select("id")
      .eq("master_id", masterId);

    if (!existingRes.error) {
      resolvedBackend = "dedicated_tables";
      const existingIds = new Set<string>(
        (existingRes.data || []).map((r: any) => String(r.id)),
      );
      const nextIds = new Set<string>(clean.map((f) => f.id));

      // Upsert folders in two passes (roots first, then children) to satisfy FK parent_id
      const ordered = [...clean].sort((a, b) => {
        if (!a.parentId && b.parentId) return -1;
        if (a.parentId && !b.parentId) return 1;
        return 0;
      });
      if (ordered.length > 0) {
        const rows = ordered.map((f) => ({
          id: f.id,
          master_id: masterId,
          name: f.name,
          parent_id: f.parentId,
          created_at: new Date(f.createdAt).toISOString(),
          updated_at: new Date(f.updatedAt).toISOString(),
        }));
        const { error: upsertErr } = await supabase
          .from("master_creature_folders")
          .upsert(rows);
        if (upsertErr) {
          throw new Error(upsertErr.message || "Falha ao salvar pastas.");
        }
      }

      const toDelete = Array.from(existingIds).filter((id) => !nextIds.has(id));
      if (toDelete.length > 0) {
        const { error: delErr } = await supabase
          .from("master_creature_folders")
          .delete()
          .eq("master_id", masterId)
          .in("id", toDelete);
        if (delErr) {
          throw new Error(delErr.message || "Falha ao remover pasta excluída.");
        }
      }

      return clean;
    }

    if (!isTableMissingError(existingRes.error)) {
      throw new Error(existingRes.error.message || "Falha ao salvar pastas.");
    }
    resolvedBackend = "players_fallback";
  }

  const recordId = getFallbackFoldersRecordId(masterId);
  const { error } = await supabase.from("players").upsert({
    id: recordId,
    data: {
      type: "master_creature_folders_v1",
      master_id: masterId,
      folders: clean,
      updatedAt: Date.now(),
    },
    updated_at: nowIso,
  });

  if (error) {
    throw new Error(error.message || "Falha ao salvar pastas de criaturas.");
  }

  return clean;
}

export async function listMasterCreatureSummaries(
  masterId: string,
): Promise<CreatureSummary[]> {
  if (!masterId) return [];

  if (resolvedBackend !== "players_fallback") {
    const { data, error } = await supabase
      .from("master_creatures")
      .select(
        "id, master_id, folder_id, name, description, description_preview, lv, affiliations, hp_max, pe_max, sm_max, skills_count, legacy_extra_id, updated_at",
      )
      .eq("master_id", masterId)
      .order("updated_at", { ascending: false });

    if (!error) {
      resolvedBackend = "dedicated_tables";
      return sortCreatureSummaries(
        (data || []).map((row: any) => {
          const description =
            typeof row.description === "string"
              ? row.description
              : typeof row.description_preview === "string"
                ? row.description_preview
                : "";
          const descriptionPreview =
            typeof row.description_preview === "string" &&
            row.description_preview.trim()
              ? row.description_preview
              : buildCreatureDescriptionPreview(description);
          const rawLv = Number(row.lv);
          return {
            id: String(row.id),
            masterId: String(row.master_id || masterId),
            name: normalizeCreatureName(row.name),
            folderId:
              typeof row.folder_id === "string" && row.folder_id.trim()
                ? row.folder_id.trim()
                : null,
            description,
            descriptionPreview,
            lv: Number.isFinite(rawLv) && rawLv >= 1 ? Math.floor(rawLv) : 1,
            affiliations: normalizeRitualAffiliations(row.affiliations),
            hpMax: Math.max(1, Number(row.hp_max) || 26),
            peMax: Math.max(0, Number(row.pe_max) || 10),
            smMax: Math.max(1, Number(row.sm_max) || 34),
            skillsCount: Math.max(0, Number(row.skills_count) || 0),
            legacyExtraId:
              typeof row.legacy_extra_id === "string" && row.legacy_extra_id.trim()
                ? row.legacy_extra_id.trim()
                : null,
            updatedAt: Date.parse(row.updated_at) || Date.now(),
          };
        }),
      );
    }

    if (!isSchemaMissingError(error)) {
      throw new Error(error.message || "Falha ao carregar lista de criaturas.");
    }
    resolvedBackend = "players_fallback";
  }

  // Fallback enxuto na tabela `players`: projeta campos de perfil/resumo sem transferir skills/rituais/blocos
  const { data, error } = await supabase
    .from("players")
    .select(
      "id, updated_at, creature_id:data->>id, master_id:data->>master_id, name:data->>name, folder_id:data->>folderId, description:data->>description, description_preview:data->>descriptionPreview, lv:data->>lv, affiliations:data->affiliations, hp_max:data->>hpMax, pe_max:data->>peMax, sm_max:data->>smMax, skills_count:data->>skillsCount, legacy_extra_id:data->>legacyExtraId, updated_ts:data->>updatedAt",
    )
    .like("id", `${CREATURE_RECORD_PREFIX}%`)
    .not("id", "like", "CREATURE_FOLDERS_%")
    .eq("data->>master_id", masterId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Falha ao carregar lista de criaturas.");
  }

  return sortCreatureSummaries(
    (data || []).map((row: any) => {
      const rawId =
        typeof row.creature_id === "string" && row.creature_id.length > 0
          ? row.creature_id
          : String(row.id || "").replace(CREATURE_RECORD_PREFIX, "");
      const updatedNum =
        Number(row.updated_ts) || Date.parse(row.updated_at) || Date.now();
      const description =
        typeof row.description === "string"
          ? row.description
          : typeof row.description_preview === "string"
            ? row.description_preview
            : "";
      const descriptionPreview =
        typeof row.description_preview === "string" &&
        row.description_preview.trim()
          ? row.description_preview
          : buildCreatureDescriptionPreview(description);
      const rawLv = Number(row.lv);
      return {
        id: rawId,
        masterId: String(row.master_id || masterId),
        name: normalizeCreatureName(row.name),
        folderId:
          typeof row.folder_id === "string" && row.folder_id.trim()
            ? row.folder_id.trim()
            : null,
        description,
        descriptionPreview,
        lv: Number.isFinite(rawLv) && rawLv >= 1 ? Math.floor(rawLv) : 1,
        affiliations: normalizeRitualAffiliations(row.affiliations),
        hpMax: Math.max(1, Number(row.hp_max) || 26),
        peMax: Math.max(0, Number(row.pe_max) || 10),
        smMax: Math.max(1, Number(row.sm_max) || 34),
        skillsCount: Math.max(0, Number(row.skills_count) || 0),
        legacyExtraId:
          typeof row.legacy_extra_id === "string" && row.legacy_extra_id.trim()
            ? row.legacy_extra_id.trim()
            : null,
        updatedAt: updatedNum,
      };
    }),
  );
}

export async function getMasterCreatureById(
  creatureId: string,
  masterId: string,
): Promise<CreatureRecord | null> {
  if (!creatureId || !masterId) return null;

  if (resolvedBackend !== "players_fallback") {
    const { data, error } = await supabase
      .from("master_creatures")
      .select(
        "id, master_id, folder_id, name, description, lv, affiliations, variables, hp_max, pe_max, sm_max, skills_count, rituals, modes, sheet_blocks, sheet_version, legacy_extra_id, created_at, updated_at",
      )
      .eq("id", creatureId)
      .eq("master_id", masterId)
      .maybeSingle();

    if (!error) {
      resolvedBackend = "dedicated_tables";
      if (!data) return null;

      const { data: skillsRows, error: skillsErr } = await supabase
        .from("master_creature_skills")
        .select("id, ownership, library_skill_id, skill_data, position")
        .eq("creature_id", creatureId)
        .eq("master_id", masterId)
        .order("position", { ascending: true });

      if (skillsErr) {
        throw new Error(skillsErr.message || "Falha ao carregar skills da criatura.");
      }

      const skills: CreatureSkillEntry[] = normalizeCreatureSkills(
        (skillsRows || []).map((r: any) => ({
          id: r.id,
          ownership: r.ownership,
          librarySkillId: r.library_skill_id,
          skillData: r.skill_data,
        })),
      );

      return normalizeCreatureRecord(
        {
          ...data,
          skills,
        },
        masterId,
      );
    }

    if (!isSchemaMissingError(error)) {
      throw new Error(error.message || "Falha ao abrir ficha da criatura.");
    }
    resolvedBackend = "players_fallback";
  }

  const recordId = getFallbackCreatureRecordId(creatureId);
  const { data, error } = await supabase
    .from("players")
    .select("id, data, updated_at")
    .eq("id", recordId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Falha ao abrir ficha da criatura.");
  }
  if (!data || !data.data || typeof data.data !== "object") return null;

  const payload = data.data as Record<string, any>;
  if (typeof payload.master_id === "string" && payload.master_id !== masterId) {
    return null;
  }

  return normalizeCreatureRecord(payload, masterId);
}

export async function saveMasterCreature(
  creature: CreatureRecord,
  masterId: string,
): Promise<CreatureRecord> {
  if (!masterId) {
    throw new Error("Identificador do Mestre indisponível.");
  }
  const normalized = normalizeCreatureRecord(
    {
      ...creature,
      masterId,
      updatedAt: Date.now(),
    },
    masterId,
  );
  if (!normalized) {
    throw new Error("Dados da criatura inválidos.");
  }

  const { hpMax, peMax, smMax } = calculateCreatureStats(normalized.variables);
  const finalRecord: CreatureRecord = {
    ...normalized,
    hpMax,
    peMax,
    smMax,
    descriptionPreview: buildCreatureDescriptionPreview(normalized.description),
    skillsCount: normalized.skills.length,
  };
  const nowIso = new Date(finalRecord.updatedAt).toISOString();

  if (resolvedBackend !== "players_fallback") {
    const { error: upsertErr } = await supabase.from("master_creatures").upsert({
      id: finalRecord.id,
      master_id: masterId,
      folder_id: finalRecord.folderId,
      name: finalRecord.name,
      description: finalRecord.description,
      lv: finalRecord.lv,
      affiliations: finalRecord.affiliations,
      variables: finalRecord.variables,
      hp_max: finalRecord.hpMax,
      pe_max: finalRecord.peMax,
      sm_max: finalRecord.smMax,
      skills_count: finalRecord.skills.length,
      rituals: finalRecord.rituals,
      modes: finalRecord.modes,
      sheet_blocks: finalRecord.sheetBlocks,
      sheet_version: finalRecord.sheetVersion,
      legacy_extra_id: finalRecord.legacyExtraId ?? null,
      created_at: new Date(finalRecord.createdAt).toISOString(),
      updated_at: nowIso,
    });

    if (!upsertErr) {
      resolvedBackend = "dedicated_tables";

      // Sincroniza a tabela de skills da criatura: upsert das atuais e remoção das órfãs desta criatura
      const existingSkillsRes = await supabase
        .from("master_creature_skills")
        .select("id")
        .eq("creature_id", finalRecord.id)
        .eq("master_id", masterId);

      if (existingSkillsRes.error) {
        throw new Error(
          existingSkillsRes.error.message || "Falha ao sincronizar skills da criatura.",
        );
      }

      if (finalRecord.skills.length > 0) {
        const skillRows = finalRecord.skills.map((entry, idx) => ({
          id: entry.id,
          creature_id: finalRecord.id,
          master_id: masterId,
          ownership: entry.ownership,
          library_skill_id:
            entry.ownership === "linked" ? entry.librarySkillId ?? null : null,
          skill_data: entry.skillData,
          position: idx,
          updated_at: nowIso,
        }));

        const { error: skillsUpsertErr } = await supabase
          .from("master_creature_skills")
          .upsert(skillRows);
        if (skillsUpsertErr) {
          throw new Error(
            skillsUpsertErr.message || "Falha ao salvar skills da criatura.",
          );
        }
      }

      const nextIds = new Set(finalRecord.skills.map((s) => s.id));
      const staleSkillIds = (existingSkillsRes.data || [])
        .map((r: any) => String(r.id))
        .filter((id) => !nextIds.has(id));

      if (staleSkillIds.length > 0) {
        const { error: staleDelErr } = await supabase
          .from("master_creature_skills")
          .delete()
          .eq("creature_id", finalRecord.id)
          .eq("master_id", masterId)
          .in("id", staleSkillIds);
        if (staleDelErr) {
          throw new Error(
            staleDelErr.message || "Falha ao limpar skills removidas da criatura.",
          );
        }
      }

      return finalRecord;
    }

    if (!isSchemaMissingError(upsertErr)) {
      throw new Error(upsertErr.message || "Falha ao salvar criatura no banco.");
    }
    resolvedBackend = "players_fallback";
  }

  const recordId = getFallbackCreatureRecordId(finalRecord.id);
  const { error } = await supabase.from("players").upsert({
    id: recordId,
    data: {
      type: "master_creature_v1",
      master_id: masterId,
      ...finalRecord,
    },
    updated_at: nowIso,
  });

  if (error) {
    throw new Error(error.message || "Falha ao salvar criatura no banco.");
  }

  return finalRecord;
}

/**
 * Atualiza a pasta de um conjunto de criaturas (usado ao excluir uma pasta).
 */
export async function bulkMoveMasterCreaturesFolder(
  creatureIds: string[],
  targetFolderId: string | null,
  masterId: string,
): Promise<void> {
  if (!masterId || creatureIds.length === 0) return;

  if (resolvedBackend !== "players_fallback") {
    const { error } = await supabase
      .from("master_creatures")
      .update({
        folder_id: targetFolderId,
        updated_at: new Date().toISOString(),
      })
      .eq("master_id", masterId)
      .in("id", creatureIds);

    if (!error) {
      resolvedBackend = "dedicated_tables";
      return;
    }
    if (!isTableMissingError(error)) {
      throw new Error(error.message || "Falha ao mover criaturas da pasta.");
    }
    resolvedBackend = "players_fallback";
  }

  for (const cid of creatureIds) {
    const full = await getMasterCreatureById(cid, masterId);
    if (full) {
      await saveMasterCreature({ ...full, folderId: targetFolderId }, masterId);
    }
  }
}

/**
 * Exclui permanentemente uma criatura da Biblioteca do Mestre:
 * - Remove a ficha original do banco de dados.
 * - Remove suas Skills exclusivas e vínculos (ON DELETE CASCADE nas tabelas dedicadas,
 *   ou exclusão do registro isolado CREATURE_<id> no fallback).
 * - NUNCA exclui Skills compartilhadas da Biblioteca (`MASTER_LIBRARY`).
 * - NUNCA remove instâncias já invocadas em sessões (`EXTRA_FICHA_*`).
 */
export async function deleteMasterCreature(
  creatureId: string,
  masterId: string,
): Promise<void> {
  if (!creatureId || !masterId) return;

  if (resolvedBackend !== "players_fallback") {
    // Limpa explicitamente skills da criatura antes de remover o pai (além do ON DELETE CASCADE)
    const { error: skillsDelErr } = await supabase
      .from("master_creature_skills")
      .delete()
      .eq("creature_id", creatureId)
      .eq("master_id", masterId);

    if (!skillsDelErr) {
      resolvedBackend = "dedicated_tables";
      const { error: creatureDelErr } = await supabase
        .from("master_creatures")
        .delete()
        .eq("id", creatureId)
        .eq("master_id", masterId);

      if (creatureDelErr) {
        throw new Error(
          creatureDelErr.message || "Falha ao excluir criatura permanentemente.",
        );
      }
      return;
    }

    if (!isTableMissingError(skillsDelErr)) {
      throw new Error(
        skillsDelErr.message || "Falha ao remover skills exclusivas da criatura.",
      );
    }
    resolvedBackend = "players_fallback";
  }

  const recordId = getFallbackCreatureRecordId(creatureId);
  const { error } = await supabase
    .from("players")
    .delete()
    .eq("id", recordId)
    .eq("data->>master_id", masterId);

  if (error) {
    throw new Error(
      error.message || "Falha ao excluir criatura permanentemente.",
    );
  }
}

export { toCreatureSummary };
