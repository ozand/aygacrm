"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Key,
  Trash2,
  Copy,
  Check,
  Loader2,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import {
  getApiTokens,
  createApiToken,
  deleteApiToken,
  revokeAllApiTokens,
  API_ABILITIES,
} from "@/lib/actions/api-tokens";
import { formatDistanceToNow } from "date-fns";

interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  abilities: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export function ApiTokenManager() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create form state
  const [tokenName, setTokenName] = useState("");
  const [expiresIn, setExpiresIn] = useState<string>("never");
  const [selectedAbilities, setSelectedAbilities] = useState<string[]>(["*"]);

  // New token display
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadTokens();
  }, []);

  async function loadTokens() {
    try {
      const data = await getApiTokens();
      setTokens(data);
    } catch (error) {
      console.error("Error loading tokens:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!tokenName.trim()) return;

    setSaving(true);
    try {
      const expiresInDays =
        expiresIn === "never"
          ? undefined
          : expiresIn === "30"
          ? 30
          : expiresIn === "90"
          ? 90
          : expiresIn === "365"
          ? 365
          : undefined;

      const result = await createApiToken({
        name: tokenName.trim(),
        abilities: selectedAbilities,
        expiresInDays,
      });

      setNewToken(result.token);
      await loadTokens();
      setTokenName("");
      setExpiresIn("never");
      setSelectedAbilities(["*"]);
    } catch (error) {
      console.error("Error creating token:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteApiToken(id);
      await loadTokens();
    } catch (error) {
      console.error("Error deleting token:", error);
    }
  }

  async function handleRevokeAll() {
    try {
      await revokeAllApiTokens();
      await loadTokens();
    } catch (error) {
      console.error("Error revoking tokens:", error);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function closeNewTokenDialog() {
    setNewToken(null);
    setIsCreateOpen(false);
  }

  function getAbilityLabel(ability: string): string {
    if (ability === "*") return "Full Access";
    const found = API_ABILITIES.find((a) => a.value === ability);
    return found ? found.label : ability;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Tokens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Tokens
            </CardTitle>
            <CardDescription>
              Manage API tokens for external integrations and MCP servers
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {tokens.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Revoke All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revoke All Tokens?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will revoke all your API tokens. Any applications
                      using these tokens will immediately lose access.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleRevokeAll}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Revoke All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Token
                </Button>
              </DialogTrigger>
              <DialogContent>
                {newToken ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Token Created</DialogTitle>
                      <DialogDescription>
                        Copy your token now. You won&apos;t be able to see it again!
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="p-4 bg-muted rounded-lg font-mono text-sm break-all">
                        {newToken}
                      </div>
                      <Button
                        onClick={() => copyToClipboard(newToken)}
                        className="w-full"
                        variant={copied ? "secondary" : "default"}
                      >
                        {copied ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Token
                          </>
                        )}
                      </Button>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={closeNewTokenDialog}>
                        Done
                      </Button>
                    </DialogFooter>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Create API Token</DialogTitle>
                      <DialogDescription>
                        Create a new token for API access
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="token-name">Token Name</Label>
                        <Input
                          id="token-name"
                          value={tokenName}
                          onChange={(e) => setTokenName(e.target.value)}
                          placeholder="e.g., MCP Server, Mobile App"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="expires">Expires</Label>
                        <Select value={expiresIn} onValueChange={setExpiresIn}>
                          <SelectTrigger id="expires">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="never">Never</SelectItem>
                            <SelectItem value="30">30 days</SelectItem>
                            <SelectItem value="90">90 days</SelectItem>
                            <SelectItem value="365">1 year</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Permissions</Label>
                        <div className="text-sm text-muted-foreground mb-2">
                          Full access is recommended for MCP servers
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {API_ABILITIES.slice(0, 4).map((ability) => (
                            <Badge
                              key={ability.value}
                              variant={
                                selectedAbilities.includes(ability.value)
                                  ? "default"
                                  : "outline"
                              }
                              className="cursor-pointer"
                              onClick={() => {
                                if (ability.value === "*") {
                                  setSelectedAbilities(["*"]);
                                } else {
                                  const filtered = selectedAbilities.filter(
                                    (a) => a !== "*"
                                  );
                                  if (filtered.includes(ability.value)) {
                                    setSelectedAbilities(
                                      filtered.filter((a) => a !== ability.value)
                                    );
                                  } else {
                                    setSelectedAbilities([
                                      ...filtered,
                                      ability.value,
                                    ]);
                                  }
                                }
                              }}
                            >
                              {ability.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsCreateOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreate}
                        disabled={saving || !tokenName.trim()}
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Create Token
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {tokens.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No API tokens yet</p>
            <p className="text-sm">
              Create a token to integrate with external apps or MCP servers
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="font-medium">{token.name}</div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-mono">{token.tokenPrefix}...</span>
                    {" · "}
                    Created{" "}
                    {formatDistanceToNow(new Date(token.createdAt), {
                      addSuffix: true,
                    })}
                    {token.lastUsedAt && (
                      <>
                        {" · "}
                        Last used{" "}
                        {formatDistanceToNow(new Date(token.lastUsedAt), {
                          addSuffix: true,
                        })}
                      </>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {token.abilities.map((ability) => (
                      <Badge key={ability} variant="secondary" className="text-xs">
                        {getAbilityLabel(ability)}
                      </Badge>
                    ))}
                    {token.expiresAt && (
                      <Badge variant="outline" className="text-xs">
                        Expires{" "}
                        {formatDistanceToNow(new Date(token.expiresAt), {
                          addSuffix: true,
                        })}
                      </Badge>
                    )}
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Token?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently revoke the token &quot;{token.name}&quot;.
                        Any applications using this token will lose access.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(token.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">API Usage</h4>
          <p className="text-sm text-muted-foreground mb-2">
            Use your token in the Authorization header:
          </p>
          <code className="text-xs bg-background p-2 rounded block">
            Authorization: Bearer YOUR_TOKEN
          </code>
          <p className="text-sm text-muted-foreground mt-2">
            API endpoint: <code className="text-xs">/api/v1/...</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
