"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Loader2,
  Sparkles,
  Trash2,
  Key,
  Bot,
  Zap,
  FileText,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { agentsIpc } from "@/lib/agents/ipc";
import { toast } from "@/components/ui/toaster";
import {
  PROVIDERS,
  PREFERRED_MODELS,
  SEARCH_PROVIDERS,
  getProviderModels,
  type ProviderId,
  type ModelOption,
  type ProviderConfig,
} from "@/lib/ai/config";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settings";

type ProviderFormState = {
  key: string;
  label: string;
  hasKey: boolean;
  saving: boolean;
  message: string | null;
  messageType: "success" | "error" | null;
};

const createInitialProviderState = (): Record<
  ProviderId,
  ProviderFormState
> => {
  return PROVIDERS.reduce((acc, provider) => {
    acc[provider.id] = {
      key: "",
      label: "",
      hasKey: false,
      saving: false,
      message: null,
      messageType: null,
    };
    return acc;
  }, {} as Record<ProviderId, ProviderFormState>);
};

const PROVIDER_ICONS: Record<ProviderId, React.ReactNode> = {
  openai: (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  ),
  google: (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  ),
  anthropic: (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.304 3.541h-3.672l6.696 16.918h3.672l-6.696-16.918zm-10.608 0L0 20.459h3.744l1.464-3.816h7.2l1.464 3.816h3.744L10.92 3.541H6.696zm.456 10.296l2.544-6.624 2.544 6.624H7.152z" />
    </svg>
  ),
  openrouter: (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M8 12h8M12 8v8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
};

const MODEL_ROLES = [
  {
    id: "chat",
    label: "Default Chat",
    description: "Main model for conversations",
    icon: Bot,
  },
  {
    id: "title",
    label: "Title Generation",
    description: "Generate chat titles",
    icon: FileText,
  },
  {
    id: "compact",
    label: "Compact/Summary",
    description: "Summarize conversations",
    icon: Zap,
  },
] as const;

type SearchProviderFormState = {
  key: string;
  hasKey: boolean;
  saving: boolean;
  message: string | null;
  messageType: "success" | "error" | null;
};

type SearchProviderId = "tavily" | "perplexity";

const createInitialSearchProviderState = (): Record<SearchProviderId, SearchProviderFormState> => ({
  tavily: { key: "", hasKey: false, saving: false, message: null, messageType: null },
  perplexity: { key: "", hasKey: false, saving: false, message: null, messageType: null },
});

export default function LLMSettingsPage() {
  const [providerForms, setProviderForms] = useState<
    Record<ProviderId, ProviderFormState>
  >(createInitialProviderState);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [expandedProvider, setExpandedProvider] = useState<ProviderId | null>(
    null
  );
  const [searchProviderForms, setSearchProviderForms] = useState<
    Record<SearchProviderId, SearchProviderFormState>
  >(createInitialSearchProviderState);
  const [expandedSearchProvider, setExpandedSearchProvider] = useState<
    string | null
  >(null);

  const preferredModels = useSettingsStore((state) => state.preferredModels);
  const setPreferredModel = useSettingsStore(
    (state) => state.setPreferredModel
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoadingProviders(true);
    agentsIpc.apiKeys
      .list()
      .then((records) => {
        if (cancelled) return;
        setProviderForms((prev) => {
          const next = { ...prev };
          records.forEach((record) => {
            const providerId = record.provider as ProviderId;
            if (next[providerId]) {
              next[providerId] = {
                ...next[providerId],
                hasKey: true,
                label: record.label ?? "",
                message: null,
                messageType: null,
              };
            }
          });
          return next;
        });
        const tavilyRecord = records.find((r) => r.provider === "tavily");
        const perplexityRecord = records.find((r) => r.provider === "perplexity");
        setSearchProviderForms((prev) => ({
          ...prev,
          tavily: { ...prev.tavily, hasKey: Boolean(tavilyRecord) },
          perplexity: { ...prev.perplexity, hasKey: Boolean(perplexityRecord) },
        }));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingProviders(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateProviderState = useCallback(
    (id: ProviderId, partial: Partial<ProviderFormState>) => {
      setProviderForms((prev) => ({
        ...prev,
        [id]: { ...prev[id], ...partial },
      }));
    },
    []
  );

  const handleSave = useCallback(
    async (id: ProviderId) => {
      const current = providerForms[id];
      const keyValue = current.key.trim();
      const labelValue = current.label.trim();

      if (!keyValue) {
        updateProviderState(id, {
          message: "API key is required",
          messageType: "error",
        });
        return;
      }

      updateProviderState(id, {
        saving: true,
        message: null,
        messageType: null,
      });

      try {
        await agentsIpc.apiKeys.save({
          provider: id,
          secret: keyValue,
          label: labelValue || undefined,
        });

        updateProviderState(id, {
          saving: false,
          hasKey: true,
          key: "",
          message: "Key saved successfully",
          messageType: "success",
        });
        toast.success(
          `${PROVIDERS.find((p) => p.id === id)?.name} API key saved`
        );
      } catch (error) {
        updateProviderState(id, {
          saving: false,
          message:
            error instanceof Error ? error.message : "Unable to save key",
          messageType: "error",
        });
      }
    },
    [providerForms, updateProviderState]
  );

  const handleRemove = useCallback(
    async (id: ProviderId) => {
      updateProviderState(id, {
        saving: true,
        message: null,
        messageType: null,
      });
      try {
        await agentsIpc.apiKeys.delete(id);
        updateProviderState(id, {
          saving: false,
          hasKey: false,
          label: "",
          key: "",
          message: "Key removed",
          messageType: "success",
        });
        toast.success("API key removed");
      } catch (error) {
        updateProviderState(id, {
          saving: false,
          message:
            error instanceof Error ? error.message : "Unable to remove key",
          messageType: "error",
        });
      }
    },
    [updateProviderState]
  );

  const updateSearchProviderState = useCallback(
    (id: SearchProviderId, partial: Partial<SearchProviderFormState>) => {
      setSearchProviderForms((prev) => ({
        ...prev,
        [id]: { ...prev[id], ...partial },
      }));
    },
    []
  );

  const handleSaveSearchProvider = useCallback(async (id: SearchProviderId) => {
    const current = searchProviderForms[id];
    const keyValue = current.key.trim();
    if (!keyValue) {
      updateSearchProviderState(id, {
        message: "API key is required",
        messageType: "error",
      });
      return;
    }

    updateSearchProviderState(id, {
      saving: true,
      message: null,
      messageType: null,
    });

    try {
      await agentsIpc.apiKeys.save({
        provider: id,
        secret: keyValue,
      });

      updateSearchProviderState(id, {
        key: "",
        hasKey: true,
        saving: false,
        message: "Key saved successfully",
        messageType: "success",
      });
      const providerName = id === "perplexity" ? "Perplexity" : "Tavily";
      toast.success(`${providerName} API key saved!`);
    } catch (error) {
      updateSearchProviderState(id, {
        saving: false,
        message: error instanceof Error ? error.message : "Unable to save key",
        messageType: "error",
      });
    }
  }, [searchProviderForms, updateSearchProviderState]);

  const handleRemoveSearchProvider = useCallback(async (id: SearchProviderId) => {
    updateSearchProviderState(id, {
      saving: true,
      message: null,
      messageType: null,
    });
    try {
      await agentsIpc.apiKeys.delete(id);
      updateSearchProviderState(id, {
        key: "",
        hasKey: false,
        saving: false,
        message: "Key removed",
        messageType: "success",
      });
      const providerName = id === "perplexity" ? "Perplexity" : "Tavily";
      toast.success(`${providerName} API key removed`);
    } catch (error) {
      updateSearchProviderState(id, {
        saving: false,
        message:
          error instanceof Error ? error.message : "Unable to remove key",
        messageType: "error",
      });
    }
  }, [updateSearchProviderState]);

  const connectedProviders = useMemo(() => {
    return PROVIDERS.filter((p) => providerForms[p.id]?.hasKey);
  }, [providerForms]);

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">LLM Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure API keys and model preferences
        </p>
      </div>

      <div className="space-y-8">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium flex items-center gap-2">
                <Key className="h-4 w-4" />
                API Keys
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Connect your API keys for each provider. Keys are stored
                securely on your device.
              </p>
            </div>
            {isLoadingProviders && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          <div className="space-y-3">
            {PROVIDERS.map((provider) => {
              const state = providerForms[provider.id];
              const isExpanded = expandedProvider === provider.id;
              const Icon = PROVIDER_ICONS[provider.id];

              return (
                <div
                  key={provider.id}
                  className={cn(
                    "rounded-lg border transition-colors",
                    state?.hasKey
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/60 bg-card"
                  )}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedProvider(isExpanded ? null : provider.id)
                    }
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <div
                      className={cn(
                        "p-2 rounded-md",
                        state?.hasKey
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {Icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {provider.name}
                        </span>
                        {state?.hasKey && (
                          <Badge variant="default" className="text-[10px] h-5">
                            Connected
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {provider.description}
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">
                      <div className="space-y-2">
                        <Label
                          htmlFor={`${provider.id}-label`}
                          className="text-xs"
                        >
                          Label (optional)
                        </Label>
                        <Input
                          id={`${provider.id}-label`}
                          placeholder="e.g., Personal, Work"
                          value={state?.label ?? ""}
                          onChange={(e) =>
                            updateProviderState(provider.id, {
                              label: e.target.value,
                            })
                          }
                          disabled={state?.saving}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor={`${provider.id}-key`}
                          className="text-xs"
                        >
                          API Key
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id={`${provider.id}-key`}
                            type="password"
                            placeholder={provider.placeholder}
                            value={state?.key ?? ""}
                            onChange={(e) =>
                              updateProviderState(provider.id, {
                                key: e.target.value,
                              })
                            }
                            disabled={state?.saving}
                            className="flex-1 h-9"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSave(provider.id)}
                            disabled={state?.saving || !state?.key?.trim()}
                            className="h-9"
                          >
                            {state?.saving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : state?.hasKey ? (
                              "Update"
                            ) : (
                              "Save"
                            )}
                          </Button>
                        </div>
                      </div>
                      {state?.hasKey && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(provider.id)}
                          disabled={state?.saving}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Remove key
                        </Button>
                      )}
                      {state?.message && (
                        <p
                          className={cn(
                            "text-xs",
                            state.messageType === "error"
                              ? "text-destructive"
                              : "text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {state.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-medium flex items-center gap-2">
              <Search className="h-4 w-4" />
              Research APIs (Optional)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add search APIs for enhanced resource discovery. Perplexity is
              recommended for best results.
            </p>
          </div>

          <div className="space-y-3">
            {SEARCH_PROVIDERS.map((provider) => {
              const providerId = provider.id as SearchProviderId;
              const formState = searchProviderForms[providerId];
              const isExpanded = expandedSearchProvider === provider.id;
              const websiteUrl = provider.id === "perplexity" ? "perplexity.ai" : "tavily.com";

              return (
                <div
                  key={provider.id}
                  className={cn(
                    "rounded-lg border transition-colors",
                    formState.hasKey
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/60 bg-card"
                  )}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSearchProvider(isExpanded ? null : provider.id)
                    }
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <div
                      className={cn(
                        "p-2 rounded-md",
                        formState.hasKey
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {provider.id === "perplexity" ? (
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M19.785 0v7.272H22.5V17.62h-2.935V24l-7.037-6.194v6.145h-1.091v-6.152L4.392 24v-6.465H1.5V7.188h2.884V0l7.053 6.494V.19h1.09v6.49L19.786 0zm-7.257 9.044v7.319l5.946 5.234V14.44l-5.946-5.397zm-1.099-.08l-5.946 5.398v7.235l5.946-5.234V8.965zm8.136 7.58h1.844V8.349H13.46l6.105 5.54v2.655zm-8.982-8.28H2.59v8.195h1.8v-2.576l6.192-5.62zM5.475 2.476v4.71h5.115l-5.115-4.71zm13.219 0l-5.115 4.71h5.115v-4.71z" fill="#22B8CD" fill-rule="nonzero"></path>
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 273.856 260.8939393939394" style={{ maxHeight: "500px" }} width="273.856" height="260.8939393939394" aria-hidden="true" role="img" >
<path fill="#8FBCFA" d="M97.1853 5.35901L127.346 53.1064C132.19 60.7745 126.68 70.7725 117.61 70.7725H105.279V142.278H87.4492V-0.00683594C91.1876 -0.00683594 94.926 1.78179 97.1853 5.35901Z"/>
<path fill="#468BFF" d="M47.5482 53.1064L77.7098 5.35901C79.9691 1.78179 83.7075 -0.00683594 87.4459 -0.00683594V142.279C81.0587 141.981 74.8755 143.829 69.616 147.544V70.7725H57.2849C48.2149 70.7725 42.7047 60.7745 47.5482 53.1064Z"/>
<path fill="#FDBB11" d="M182.003 189.445L107.34 189.445C111.648 184.622 114.201 178.481 114.476 171.615H252.782C252.782 175.353 250.993 179.092 247.416 181.351L199.669 211.512C192.001 216.356 182.003 210.846 182.003 201.776V189.445Z"/>
<path fill="#F6D785" d="M199.668 131.718L247.415 161.879C250.993 164.138 252.781 167.877 252.781 171.615H114.471C114.72 165.212 112.733 158.898 108.957 153.785H182.002V141.454C182.002 132.384 192 126.874 199.668 131.718Z"/>
<path fill="#FF9A9D" d="M46.9409 209.797L3.37891 253.359C6.02226 256.003 9.93035 257.381 14.0576 256.45L69.1472 244.014C77.9944 242.017 81.1678 231.051 74.7545 224.638L66.035 215.918L98.7916 183.055C105.771 176.075 105.462 164.899 98.6758 158.113L46.9409 209.797Z"/>
<path fill="#FE363B" d="M40.8221 190.708L73.6898 157.963C80.6694 150.983 91.8931 151.328 98.679 158.113L46.9436 209.802L3.38131 253.364C0.737954 250.721 -0.640662 246.812 0.291 242.685L12.7265 187.596C14.7236 178.748 25.6895 175.575 32.1028 181.988L40.8221 190.708Z"/>
<path fill="#2C2F32" d="M777.344 93.6689L718.337 234.049H692.704L713.348 186.567L675.156 93.6689H702.166L726.766 160.246L751.711 93.6689H777.344Z"/>
<path fill="#2C2F32" d="M664.096 70.1191V188.976H640.012V70.1191H664.096Z"/>
<path fill="#2C2F32" d="M606.041 82.2736C601.797 82.2736 598.242 80.9547 595.375 78.3168C592.622 75.5643 591.246 72.181 591.246 68.1668C591.246 64.1527 592.622 60.8267 595.375 58.1889C598.242 55.4363 601.797 54.0601 606.041 54.0601C610.284 54.0601 613.783 55.4363 616.535 58.1889C619.402 60.8267 620.836 63.6942 620.836 67.7084C620.836 71.7225 619.402 75.5643 616.535 78.3168C613.783 80.9547 610.284 82.2736 606.041 82.2736ZM617.911 93.6279V188.978H593.827V93.6279H617.911Z"/>
<path fill="#2C2F32" d="M532.3 166.783L556.385 93.6689H582.018L546.751 188.976H517.505L482.41 93.6689H508.215L532.3 166.783Z"/>
<path fill="#2C2F32" d="M371.52 140.972C371.52 131.338 373.412 122.794 377.197 115.339C381.096 107.884 386.314 102.15 392.852 98.1355C399.504 94.1213 406.901 92.1143 415.044 92.1143C422.155 92.1143 428.348 93.5479 433.624 96.4151C439.014 99.2823 443.315 102.895 446.526 107.253V93.6626H470.783V188.969H446.526V175.035C443.43 179.507 439.129 183.235 433.624 186.217C428.233 189.084 421.983 190.518 414.872 190.518C406.844 190.518 399.504 188.453 392.852 184.324C386.314 180.196 381.096 174.404 377.197 166.949C373.412 159.38 371.52 150.72 371.52 140.972ZM446.526 141.316C446.526 135.467 445.379 130.478 443.086 126.349C440.792 122.105 437.695 118.894 433.796 116.715C429.896 114.421 425.71 113.274 421.237 113.274C416.764 113.274 412.636 114.364 408.851 116.543C405.066 118.722 401.97 121.933 399.561 126.177C397.267 130.306 396.12 135.237 396.12 140.972C396.12 146.706 397.267 151.753 399.561 156.111C401.97 160.354 405.066 163.623 408.851 165.917C412.75 168.211 416.879 169.357 421.237 169.357C425.71 169.357 429.896 168.268 433.796 166.089C437.695 163.795 440.792 160.584 443.086 156.455C445.379 152.211 446.526 147.165 446.526 141.316Z"/>
<path fill="#2C2F32" d="M340.767 113.445V159.55C340.767 162.762 341.513 165.113 343.004 166.604C344.609 167.98 347.247 168.668 350.917 168.668H362.099V188.968H346.96C326.66 188.968 316.51 179.105 316.51 159.378V113.445H305.156V93.6614H316.51V70.0928H340.767V93.6614H362.099V113.445H340.767Z"/>
</svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {provider.name}
                        </span>
                        {formState.hasKey && (
                          <Badge variant="default" className="text-[10px] h-5">
                            Connected
                          </Badge>
                        )}
                        {provider.id === "perplexity" && !formState.hasKey && (
                          <Badge variant="secondary" className="text-[10px] h-5">
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {provider.description}
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">
                      <div className="space-y-2">
                        <Label htmlFor={`${provider.id}-key`} className="text-xs">
                          API Key
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id={`${provider.id}-key`}
                            type="password"
                            placeholder={provider.placeholder}
                            value={formState.key}
                            onChange={(e) =>
                              updateSearchProviderState(providerId, {
                                key: e.target.value,
                              })
                            }
                            disabled={formState.saving}
                            className="flex-1 h-9"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSaveSearchProvider(providerId)}
                            disabled={
                              formState.saving ||
                              !formState.key.trim()
                            }
                            className="h-9"
                          >
                            {formState.saving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : formState.hasKey ? (
                              "Update"
                            ) : (
                              "Save"
                            )}
                          </Button>
                        </div>
                      </div>
                      {formState.hasKey && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSearchProvider(providerId)}
                          disabled={formState.saving}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Remove key
                        </Button>
                      )}
                      {formState.message && (
                        <p
                          className={cn(
                            "text-xs",
                            formState.messageType === "error"
                              ? "text-destructive"
                              : "text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {formState.message}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Get your API key at{" "}
                        <a
                          href={`https://${websiteUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {websiteUrl}
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {connectedProviders.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Model Preferences
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose default models for different tasks
              </p>
            </div>

            <div className="space-y-4">
              {MODEL_ROLES.map((role) => {
                const Icon = role.icon;
                const currentModel = preferredModels[role.id];

                return (
                  <div
                    key={role.id}
                    className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border/60 bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{role.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {role.description}
                        </p>
                      </div>
                    </div>
                    <ModelSelector
                      providers={connectedProviders}
                      value={currentModel}
                      onChange={(modelId) =>
                        setPreferredModel(role.id, modelId)
                      }
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ModelSelector({
  providers,
  value,
  onChange,
}: {
  providers: ProviderConfig[];
  value?: string;
  onChange: (modelId: string) => void;
}) {
  const selectedModel = useMemo(() => {
    if (!value) return null;
    const [_providerId, modelId] = value.includes(":")
      ? value.split(":")
      : [null, value];

    for (const provider of providers) {
      const models = getProviderModels(provider.id);
      const found = models.find((m) => m.id === modelId || m.id === value);
      if (found) {
        return { provider, model: found };
      }
    }
    return null;
  }, [value, providers]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 min-w-[160px] justify-between"
        >
          <span className="truncate text-xs">
            {selectedModel ? selectedModel.model.label : "Select model"}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 max-h-80 overflow-y-auto"
      >
        {providers.map((provider) => {
          const models = getProviderModels(provider.id);
          const preferred = PREFERRED_MODELS[provider.id] ?? [];
          const preferredModels = models.filter((m) =>
            preferred.includes(m.id)
          );
          const otherModels = models.filter((m) => !preferred.includes(m.id));

          return (
            <div key={provider.id}>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {provider.name}
              </DropdownMenuLabel>
              {preferredModels.map((model) => (
                <ModelMenuItem
                  key={model.id}
                  model={model}
                  providerId={provider.id}
                  isSelected={value === `${provider.id}:${model.id}`}
                  onSelect={() => onChange(`${provider.id}:${model.id}`)}
                />
              ))}
              {otherModels.length > 0 && preferredModels.length > 0 && (
                <DropdownMenuSeparator />
              )}
              {otherModels.slice(0, 3).map((model) => (
                <ModelMenuItem
                  key={model.id}
                  model={model}
                  providerId={provider.id}
                  isSelected={value === `${provider.id}:${model.id}`}
                  onSelect={() => onChange(`${provider.id}:${model.id}`)}
                />
              ))}
              <DropdownMenuSeparator />
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ModelMenuItem({
  model,
  isSelected,
  onSelect,
}: {
  model: ModelOption;
  providerId: ProviderId;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="cursor-pointer">
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs truncate">{model.label}</span>
          {model.isNew && (
            <Sparkles className="h-2.5 w-2.5 text-primary shrink-0" />
          )}
        </div>
        {isSelected && <Check className="h-3 w-3 shrink-0 text-primary" />}
      </div>
    </DropdownMenuItem>
  );
}
