"use client";

import { useEffect, useState, useCallback } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  LogOut,
  Check,
  X,
  Shield,
  Loader2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { getUsers, updateUserApproval, type User } from "@/lib/api";

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const toggleApproval = async (userId: string, currentlyApproved: boolean) => {
    setToggling(userId);
    const newApproval = !currentlyApproved;
    try {
      const updated = await updateUserApproval(userId, newApproval);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? updated : u))
      );
      toast.success(
        newApproval ? "User approved" : "User access revoked"
      );
    } catch {
      toast.error("Failed to update user");
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/workspace"
              className="inline-flex items-center justify-center gap-1 rounded-md border border-input bg-background px-3 h-8 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              <Wrench className="h-4 w-4" />
              Workspace
            </a>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4 mr-1" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
              {!loading && (
                <Badge variant="secondary" className="ml-2">
                  {users.length} users
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No users found
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">User</th>
                      <th className="pb-2 font-medium">Provider</th>
                      <th className="pb-2 font-medium">Role</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b last:border-0">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            {user.avatar_url ? (
                              <img
                                src={user.avatar_url}
                                alt=""
                                className="h-8 w-8 rounded-full"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                {(user.name || user.email)[0].toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-medium">
                                {user.name || "—"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          <Badge variant="outline">
                            {user.auth_provider}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              user.role === "admin"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {user.role}
                          </Badge>
                        </td>
                        <td className="py-3">
                          {user.is_approved || user.role === "admin" ? (
                            <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                              Approved
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Pending</Badge>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          {user.role !== "admin" && (
                            <Button
                              size="sm"
                              variant={
                                user.is_approved ? "destructive" : "default"
                              }
                              onClick={() =>
                                toggleApproval(user.id, user.is_approved)
                              }
                              disabled={toggling === user.id}
                            >
                              {toggling === user.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : user.is_approved ? (
                                <>
                                  <X className="h-3 w-3 mr-1" />
                                  Revoke
                                </>
                              ) : (
                                <>
                                  <Check className="h-3 w-3 mr-1" />
                                  Approve
                                </>
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
