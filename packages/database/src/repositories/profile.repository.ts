import type {
  UserProfile,
  CreatePlatformUserInput,
  UserRole,
  InviteStaffInput,
  PushSubscriptionRecord,
  SavePushSubscriptionInput,
  PushNotificationLog,
  SendPushBroadcastInput,
  PushStats,
  AuditActor,
} from "@marketos/types";
import { state } from "../mock-data.ts";
import { getSupabase, generateUuid, isLiveDatabaseConfigured } from "./base.ts";
import { AuditRepository } from "./audit.repository.ts";

export class ProfileRepository {

/**
   * Get all user profiles across the entire platform (Super Admin)
   */
  static async getAllProfiles(): Promise<UserProfile[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && Array.isArray(data)) {
          return data as UserProfile[];
        }
      } catch (e) {
        console.warn("[Supabase] Get all profiles error:", e);
      }
    }

    if (isLiveDatabaseConfigured()) return [];
    return state.profiles;
  }

/**
   * Create or invite a new platform or tenant user (Super Admin)
   */
  static async createPlatformUser(input: CreatePlatformUserInput): Promise<UserProfile> {
    const newProfile: UserProfile = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: input.tenantId || null,
      email: input.email.toLowerCase().trim(),
      full_name: input.fullName,
      phone: input.phone || null,
      avatar_url: null,
      role: input.role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data } = await supabase
          .from("profiles")
          .insert({
            tenant_id: newProfile.tenant_id,
            email: newProfile.email,
            full_name: newProfile.full_name,
            phone: newProfile.phone,
            role: newProfile.role,
          })
          .select("id")
          .maybeSingle();

        if (data?.id) newProfile.id = data.id;
      } catch (e) {
        console.warn("[Supabase] Insert platform user fallback:", e);
      }
    }

    state.profiles.unshift(newProfile);

    await AuditRepository.recordAuditLog({
      tenantId: input.tenantId || "platform",
      action: "PLATFORM_USER_CREATED",
      entity: "profiles",
      entityId: newProfile.id,
      newData: { email: newProfile.email, role: newProfile.role, name: newProfile.full_name },
    });

    return newProfile;
  }

/**
   * Update a user's profile details (role, tenant, phone, name)
   */
  static async updateUserProfile(
    userId: string,
    data: Partial<UserProfile>
  ): Promise<UserProfile | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from("profiles")
          .update({
            ...(data.role && { role: data.role }),
            ...(data.full_name && { full_name: data.full_name }),
            ...(data.phone !== undefined && { phone: data.phone }),
            ...(data.tenant_id !== undefined && { tenant_id: data.tenant_id }),
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);
      } catch (e) {
        console.warn("[Supabase] Update user profile error:", e);
      }
    }

    const idx = state.profiles.findIndex((p) => p.id === userId);
    if (idx !== -1) {
      const old = { ...state.profiles[idx] };
      state.profiles[idx] = {
        ...state.profiles[idx],
        ...data,
        updated_at: new Date().toISOString(),
      };

      await AuditRepository.recordAuditLog({
        tenantId: state.profiles[idx].tenant_id || "platform",
        action: "PROFILE_UPDATED",
        entity: "profiles",
        entityId: userId,
        oldData: old as unknown as Record<string, unknown>,
        newData: state.profiles[idx] as unknown as Record<string, unknown>,
      });

      return state.profiles[idx];
    }
    return null;
  }

/**
   * Delete or revoke access for a user profile
   */
  static async deleteUserProfile(userId: string): Promise<boolean> {
    let supabaseDeleted = false;
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase.from("profiles").delete().eq("id", userId);
        if (error) {
          console.error("[Supabase] Delete user profile error:", error);
          if (isLiveDatabaseConfigured()) return false;
        } else {
          supabaseDeleted = true;
        }

        // Try deleting auth user if exists in Supabase Auth
        try {
          await supabase.auth.admin.deleteUser(userId);
        } catch {
          // Ignored if user only existed in profiles or wasn't an auth user
        }
      } catch (e) {
        console.warn("[Supabase] Delete user profile error:", e);
        if (isLiveDatabaseConfigured()) return false;
      }
    }

    const initialLength = state.profiles.length;
    state.profiles = state.profiles.filter((p) => p.id !== userId);

    await AuditRepository.recordAuditLog({
      tenantId: "platform",
      action: "PROFILE_DELETED",
      entity: "profiles",
      entityId: userId,
    });

    if (isLiveDatabaseConfigured()) {
      return supabaseDeleted;
    }

    return state.profiles.length < initialLength;
  }

/**
   * Get all staff members and employees for a tenant
   */
  static async getTenantStaff(tenantId: string): Promise<UserProfile[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: true });

        if (!error && Array.isArray(data)) {
          return data as UserProfile[];
        }
      } catch (e) {
        console.warn("[Supabase] Get tenant staff error:", e);
      }
    }

    if (isLiveDatabaseConfigured()) return [];
    return state.profiles.filter((p) => p.tenant_id === tenantId);
  }

/**
   * Invite or assign a new staff member to a tenant (including Supabase Auth password creation)
   */
  static async inviteStaffMember(input: InviteStaffInput): Promise<UserProfile> {
    const cleanEmail = input.email.toLowerCase().trim();
    let authUserId: string | null = null;
    const supabase = getSupabase();

    if (supabase) {
      // 1. If password provided, create or update user in Supabase Auth
      if (input.password) {
        try {
          const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
            email: cleanEmail,
            password: input.password,
            email_confirm: true,
            user_metadata: {
              full_name: input.fullName,
              tenant_id: input.tenantId,
              role: input.role,
            },
          });

          if (authUser?.user?.id) {
            authUserId = authUser.user.id;
          } else if (authErr) {
            console.warn("[Supabase] admin.createUser notice:", authErr.message);
            // If user already exists in auth, try updating password and metadata
            try {
              const { data: listData } = await supabase.auth.admin.listUsers();
              const existingUser = listData?.users?.find(
                (u) => u.email?.toLowerCase() === cleanEmail
              );
              if (existingUser) {
                authUserId = existingUser.id;
                await supabase.auth.admin.updateUserById(existingUser.id, {
                  password: input.password,
                  user_metadata: {
                    full_name: input.fullName,
                    tenant_id: input.tenantId,
                    role: input.role,
                  },
                });
              }
            } catch (listErr) {
              console.warn("[Supabase] listUsers lookup failed:", listErr);
            }
          }
        } catch (authException) {
          console.warn("[Supabase] Auth createUser exception:", authException);
        }
      }

      // 2. Insert or upsert into public.profiles
      try {
        const profilePayload: any = {
          tenant_id: input.tenantId,
          email: cleanEmail,
          full_name: input.fullName,
          phone: input.phone || null,
          role: input.role,
          updated_at: new Date().toISOString(),
        };

        if (authUserId) {
          profilePayload.id = authUserId;
        }

        const { data, error } = await supabase
          .from("profiles")
          .upsert(profilePayload, { onConflict: "email" })
          .select("*")
          .maybeSingle();

        if (!error && data) {
          const persistedProfile = data as UserProfile;
          // Synchronize in-memory state
          state.profiles = state.profiles.filter(
            (p) => p.email !== cleanEmail && p.id !== persistedProfile.id
          );
          state.profiles.push(persistedProfile);

          await AuditRepository.recordAuditLog({
            tenantId: input.tenantId,
            action: "STAFF_INVITED",
            entity: "profiles",
            entityId: persistedProfile.id,
            newData: {
              email: persistedProfile.email,
              role: persistedProfile.role,
              name: persistedProfile.full_name,
            },
          });

          return persistedProfile;
        } else if (error) {
          console.error("[Supabase] Insert/upsert profile error:", error);
          if (isLiveDatabaseConfigured()) {
            throw new Error(`Error en base de datos al asignar colaborador: ${error.message}`);
          }
        }
      } catch (e) {
        console.warn("[Supabase] Insert staff member fallback:", e);
        if (isLiveDatabaseConfigured()) {
          throw e;
        }
      }
    }

    const newProfile: UserProfile = {
      id: authUserId || `usr-${Date.now()}`,
      tenant_id: input.tenantId,
      email: cleanEmail,
      full_name: input.fullName,
      phone: input.phone || null,
      avatar_url: null,
      role: input.role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    state.profiles.push(newProfile);

    await AuditRepository.recordAuditLog({
      tenantId: input.tenantId,
      action: "STAFF_INVITED",
      entity: "profiles",
      entityId: newProfile.id,
      newData: { email: newProfile.email, role: newProfile.role, name: newProfile.full_name },
    });

    return newProfile;
  }

  /**
   * Reset or update password for a staff member / user profile
   */
  static async resetStaffPassword(
    tenantId: string,
    profileId: string,
    newPassword: string
  ): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: profile, error: profErr } = await supabase
          .from("profiles")
          .select("id, email, tenant_id")
          .eq("id", profileId)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (profErr || !profile) {
          console.warn("[Supabase] Reset password: profile not found in tenant:", profErr);
          if (isLiveDatabaseConfigured()) return false;
        }

        // Try updating by profileId (if auth user id == profile id)
        const { error: authErr } = await supabase.auth.admin.updateUserById(profileId, {
          password: newPassword,
        });

        if (!authErr) {
          await AuditRepository.recordAuditLog({
            tenantId,
            action: "PASSWORD_RESET",
            entity: "profiles",
            entityId: profileId,
          });
          return true;
        }

        // If not found by ID directly, try finding by email
        if (profile?.email) {
          const { data: listData } = await supabase.auth.admin.listUsers();
          const targetAuthUser = listData?.users?.find(
            (u) => u.email?.toLowerCase() === profile.email.toLowerCase()
          );
          if (targetAuthUser) {
            const { error: updateErr } = await supabase.auth.admin.updateUserById(targetAuthUser.id, {
              password: newPassword,
            });
            if (!updateErr) {
              await AuditRepository.recordAuditLog({
                tenantId,
                action: "PASSWORD_RESET",
                entity: "profiles",
                entityId: profileId,
              });
              return true;
            }
          } else {
            // User doesn't exist in auth.users yet, create auth user for them!
            const { error: createErr } = await supabase.auth.admin.createUser({
              email: profile.email,
              password: newPassword,
              email_confirm: true,
              user_metadata: {
                tenant_id: tenantId,
              },
            });
            if (!createErr) {
              await AuditRepository.recordAuditLog({
                tenantId,
                action: "PASSWORD_RESET",
                entity: "profiles",
                entityId: profileId,
              });
              return true;
            }
          }
        }
        return false;
      } catch (e) {
        console.error("[Supabase] Reset password exception:", e);
        return false;
      }
    }
    return true;
  }

/**
   * Update a staff member's role
   */
  static async updateStaffRole(
    tenantId: string,
    profileId: string,
    newRole: UserRole
  ): Promise<UserProfile | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from("profiles")
          .update({ role: newRole, updated_at: new Date().toISOString() })
          .eq("id", profileId)
          .eq("tenant_id", tenantId);
      } catch (e) {
        console.warn("[Supabase] Update staff role error:", e);
      }
    }

    const member = state.profiles.find(
      (p) => p.id === profileId && p.tenant_id === tenantId
    );
    if (member) {
      const oldRole = member.role;
      member.role = newRole;
      member.updated_at = new Date().toISOString();

      await AuditRepository.recordAuditLog({
        tenantId,
        action: "ROLE_UPDATED",
        entity: "profiles",
        entityId: profileId,
        oldData: { role: oldRole },
        newData: { role: newRole },
      });
      return member;
    }
    return null;
  }

/**
   * Get user profile by ID or Email
   */
  static async getUserProfile(userIdOrEmail: string): Promise<UserProfile | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .or(`id.eq.${userIdOrEmail},email.eq.${userIdOrEmail.toLowerCase().trim()}`)
          .maybeSingle();

        if (data) return data as UserProfile;
      } catch (e) {
        console.warn("[Supabase] Get user profile error:", e);
      }
    }

    const mem = state.profiles.find(
      (p) =>
        p.id === userIdOrEmail ||
        p.email.toLowerCase() === userIdOrEmail.toLowerCase().trim()
    );
    return mem || null;
  }

/**
   * Save or update client device push subscription for a tenant
   */
  static async savePushSubscription(
    input: SavePushSubscriptionInput
  ): Promise<PushSubscriptionRecord> {
    const now = new Date().toISOString();
    const id = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const record: PushSubscriptionRecord = {
      id,
      tenant_id: input.tenantId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      customer_id: input.customerId || null,
      user_agent: input.userAgent || null,
      created_at: now,
      updated_at: now,
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("push_subscriptions")
          .upsert(
            {
              tenant_id: input.tenantId,
              endpoint: input.endpoint,
              p256dh: input.p256dh,
              auth: input.auth,
              customer_id: input.customerId || null,
              user_agent: input.userAgent || null,
              updated_at: now,
            },
            { onConflict: "endpoint" }
          )
          .select()
          .maybeSingle();

        if (!error && data) {
          record.id = data.id;
        }
      } catch (err) {
        console.warn("[MarketOS] Could not save push subscription to Supabase:", err);
      }
    }

    // Update in-memory state
    const existingIdx = state.pushSubscriptions.findIndex(
      (s) => s.endpoint === input.endpoint
    );
    if (existingIdx !== -1) {
      state.pushSubscriptions[existingIdx] = {
        ...state.pushSubscriptions[existingIdx],
        tenant_id: input.tenantId,
        p256dh: input.p256dh,
        auth: input.auth,
        customer_id: input.customerId || null,
        user_agent: input.userAgent || null,
        updated_at: now,
      };
      return state.pushSubscriptions[existingIdx];
    } else {
      state.pushSubscriptions.push(record);
      return record;
    }
  }

/**
   * Get all active push subscriptions for a tenant
   */
  static async getPushSubscriptions(
    tenantId: string
  ): Promise<PushSubscriptionRecord[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("push_subscriptions")
          .select("*")
          .eq("tenant_id", tenantId);

        if (!error && Array.isArray(data)) {
          return data as PushSubscriptionRecord[];
        }
      } catch (err) {
        console.warn("[MarketOS] Could not fetch push subscriptions from Supabase:", err);
      }
    }

    if (isLiveDatabaseConfigured()) return [];
    return state.pushSubscriptions.filter((s) => s.tenant_id === tenantId);
  }

/**
   * Delete an expired or revoked subscription endpoint
   */
  static async deletePushSubscription(endpoint: string): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", endpoint);
      } catch (err) {
        console.warn("[MarketOS] Could not delete push subscription from Supabase:", err);
      }
    }

    state.pushSubscriptions = state.pushSubscriptions.filter(
      (s) => s.endpoint !== endpoint
    );
  }

/**
   * Record a push broadcast log for audit & metrics
   */
  static async recordPushNotificationLog(input: {
    tenantId: string;
    title: string;
    body: string;
    url?: string;
    targetType?: "all" | "customers" | "with_orders" | "without_orders" | string;
    sentCount: number;
    createdBy?: string | null;
  }): Promise<PushNotificationLog> {
    const now = new Date().toISOString();
    const id = `log-${Date.now()}`;
    const logRecord: PushNotificationLog = {
      id,
      tenant_id: input.tenantId,
      title: input.title,
      body: input.body,
      url: input.url || "/",
      target_type: input.targetType || "all",
      sent_count: input.sentCount,
      created_by: input.createdBy || null,
      created_at: now,
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("push_notifications_log").insert({
          tenant_id: input.tenantId,
          title: input.title,
          body: input.body,
          url: input.url || "/",
          target_type: input.targetType || "all",
          sent_count: input.sentCount,
          created_by: input.createdBy || null,
          created_at: now,
        });
      } catch (err) {
        console.warn("[MarketOS] Could not save push log to Supabase:", err);
      }
    }

    state.pushLogs.unshift(logRecord);
    return logRecord;
  }

/**
   * Get push notification logs for a tenant
   */
  static async getPushNotificationLogs(
    tenantId: string
  ): Promise<PushNotificationLog[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("push_notifications_log")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (!error && Array.isArray(data)) {
          return data as PushNotificationLog[];
        }
      } catch (err) {
        console.warn("[MarketOS] Could not fetch push logs from Supabase:", err);
      }
    }

    if (isLiveDatabaseConfigured()) return [];
    return state.pushLogs
      .filter((l) => l.tenant_id === tenantId)
      .slice(0, 50);
  }

/**
   * Get push statistics for a tenant
   */
  static async getPushStats(tenantId: string): Promise<PushStats> {
    const subscriptions = await this.getPushSubscriptions(tenantId);
    const logs = await this.getPushNotificationLogs(tenantId);

    const totalSent = logs.reduce((acc, l) => acc + l.sent_count, 0);
    const lastSentAt = logs.length > 0 ? logs[0].created_at : null;

    return {
      subscriberCount: subscriptions.length,
      totalSentCount: totalSent,
      lastSentAt,
    };
  }
}
