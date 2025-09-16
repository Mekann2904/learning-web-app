// src/lib/storage.supabase.ts
import { supabaseBrowser } from "./supabase";
import type { Database } from "./database.types";

export type Task = {
  id: string;
  title: string;
  detail?: string;
  done: boolean;
  createdAt: number;
  updatedAt: number;
};

type Row = Database["public"]["Tables"]["tasks"]["Row"];

function map(row: Row): Task {
  const created = (row as any).inserted_at ?? (row as any).created_at ?? row.updated_at;
  return {
    id: String(row.id),
    title: row.title ?? "",
    detail: row.detail ?? undefined,
    done: !!row.done,
    createdAt: new Date(created).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export async function list(): Promise<Task[]> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(map);
}

export async function get(id: string): Promise<Task | undefined> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? map(data) : undefined;
}

export async function create(
  t: Omit<Task, "id" | "createdAt" | "updatedAt">
): Promise<Task> {
  const supabase = supabaseBrowser();
  // user_id はDB側で default auth.uid() を使って設定されるので、ペイロードに含めない
  const payload = {
    title: t.title,
    detail: t.detail,
    done: t.done ?? false,
  };
  const { data, error } = await supabase
    .from("tasks")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return map(data);
}

export async function update(
  id: string,
  patch: Partial<Omit<Task, "id" | "createdAt">>
): Promise<Task | undefined> {
  const supabase = supabaseBrowser();
  const payload: Partial<Row> = {};
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.detail !== undefined) payload.detail = patch.detail;
  if (patch.done !== undefined) payload.done = patch.done;

  const { data, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? map(data) : undefined;
}

export async function remove(id: string): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}
