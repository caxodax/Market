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
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("profiles").delete().eq("id", userId);
      } catch (e) {
        console.warn("[Supabase] Delete user profile error:", e);
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
   * Invite or assign a new staff member to a tenant
   */
  static async inviteStaffMember(input: InviteStaffInput): Promise<UserProfile> {
    const newProfile: UserProfile = {
      id: `usr-${Date.now()}`,
      tenant_id: input.tenantId,
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
            tenant_id: input.tenantId,
            email: newProfile.email,
            full_name: newProfile.full_name,
            phone: newProfile.phone,
            role: newProfile.role,
          })
          .select("id")
          .maybeSingle();

        if (data) newProfile.id = data.id;
      } catch (e) {
        console.warn("[Supabase] Insert staff member fallback:", e);
      }
    }

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
