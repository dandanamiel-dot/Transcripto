"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, KeyRound } from "lucide-react";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type ApiKeyStatus } from "@/lib/api";
import { HE } from "@/lib/constants";

type Draft = Record<string, string>;

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKeyStatus[] | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [savingName, setSavingName] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await api.settings.listApiKeys();
    setKeys(list);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (name: string, value: string) => {
    setError(null);
    setSavingName(name);
    try {
      await api.settings.setApiKey(name, value);
      setDraft((d) => ({ ...d, [name]: "" }));
      setSavedName(name);
      setTimeout(() => setSavedName(null), 1500);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : HE.settings.saveError);
    } finally {
      setSavingName(null);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <h1 className="mb-6 text-2xl font-bold">{HE.settings.title}</h1>

          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4" />
                {HE.settings.apiKeysTitle}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {HE.settings.apiKeysDescription}
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {keys === null ? (
                <p className="text-sm text-muted-foreground">
                  {HE.common.loading}
                </p>
              ) : (
                keys.map((k) => (
                  <ApiKeyRow
                    key={k.name}
                    status={k}
                    value={draft[k.name] ?? ""}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, [k.name]: v }))
                    }
                    onSave={(v) => save(k.name, v)}
                    onClear={() => save(k.name, "")}
                    isSaving={savingName === k.name}
                    justSaved={savedName === k.name}
                  />
                ))
              )}
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

function ApiKeyRow({
  status,
  value,
  onChange,
  onSave,
  onClear,
  isSaving,
  justSaved,
}: {
  status: ApiKeyStatus;
  value: string;
  onChange: (v: string) => void;
  onSave: (v: string) => void;
  onClear: () => void;
  isSaving: boolean;
  justSaved: boolean;
}) {
  const stateLabel = status.is_set
    ? status.source === "env"
      ? HE.settings.sourceEnv
      : HE.settings.sourceDb
    : HE.settings.notSet;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium">{status.label_he}</label>
        <span
          className={`text-xs ${status.is_set ? "text-emerald-600" : "text-muted-foreground"}`}
        >
          {status.is_set ? `${stateLabel} · ${status.masked}` : stateLabel}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="password"
          dir="ltr"
          autoComplete="off"
          placeholder={HE.settings.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) onSave(value.trim());
          }}
          className="h-9 flex-1 font-mono text-sm"
        />
        <Button
          size="sm"
          disabled={!value.trim() || isSaving}
          onClick={() => onSave(value.trim())}
        >
          {justSaved ? (
            <>
              <Check className="h-4 w-4 me-1" />
              {HE.settings.saved}
            </>
          ) : (
            HE.settings.save
          )}
        </Button>
        {status.is_set && status.source === "db" && (
          <Button
            size="sm"
            variant="ghost"
            disabled={isSaving}
            onClick={onClear}
          >
            {HE.settings.clear}
          </Button>
        )}
      </div>
    </div>
  );
}
