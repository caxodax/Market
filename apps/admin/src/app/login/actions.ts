"use server";

import { cookies } from "next/headers";
import { MarketOSRepository, createServerComponentClient } from "@marketos/database";
import { UserProfile, UserRole } from "@marketos/types";

const TENANT_ID = process.env.DEFAULT_TENANT_ID || "shop-market-ca";

/**
 * Creates Supabase SSR client with async cookies for Next.js 16
 */
async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  return createServerComponentClient({
    get(name: string) {
      return cookieStore.get(name);
    },
    set(name: string, value: string, options: any) {
      try {
        cookieStore.set(name, value, options);
      } catch {
        // Ignored in read-only server component contexts
      }
    },
    remove(name: string, options: any) {
      try {
        cookieStore.delete(name);
      } catch {
        // Ignored in read-only server component contexts
      }
    },
  });
}

/**
 * Login action for Tenant Admin
 */
export async function loginAdminAction(email: string, password?: string) {
  const cookieStore = await cookies();
  const cleanEmail = email.toLowerCase().trim();

  try {
    const supabase = await getSupabaseServerClient();
    let authUserId: string | null = null;

    // 1. Try Supabase Auth password sign-in if password provided
    if (supabase && password) {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (!authError && authData.user) {
        authUserId = authData.user.id;
      }
    }

    // 2. Fetch User Profile from Supabase or Repository
    let profile: UserProfile | null = null;
    if (authUserId) {
      profile = await MarketOSRepository.getUserProfile(authUserId);
    }
    if (!profile) {
      profile = await MarketOSRepository.getUserProfile(cleanEmail);
    }

    // Fallback default for Shop Market Owner if first login
    if (!profile && (cleanEmail === "owner@shopmarket.com" || cleanEmail === "admin@shopmarket.com")) {
      profile = {
        id: "usr-owner-shop-market",
        tenant_id: TENANT_ID,
        email: cleanEmail,
        full_name: "Luis Montes (Dueño)",
        phone: "+58 424-5919577",
        avatar_url: null,
        role: "TENANT_OWNER",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    if (!profile) {
      return {
        success: false,
        error: "Credenciales inválidas o usuario no registrado en este comercio.",
      };
    }

    // 3. Verify Role Authorization for Tenant Administration
    const allowedRoles: UserRole[] = [
      "PLATFORM_SUPER_ADMIN",
      "TENANT_OWNER",
      "TENANT_MANAGER",
      "TENANT_CASHIER",
      "TENANT_INVENTORY",
      "TENANT_DELIVERY",
    ];

    if (!allowedRoles.includes(profile.role)) {
      return {
        success: false,
        error: "Acceso denegado: tu rol no tiene permisos administrativos.",
      };
    }

    // 4. Verify Tenant matching (Super Admin bypasses tenant isolation)
    if (profile.role !== "PLATFORM_SUPER_ADMIN" && profile.tenant_id && profile.tenant_id !== TENANT_ID) {
      return {
        success: false,
        error: "Este usuario no pertenece a la sucursal de este comercio.",
      };
    }

    // 5. Store session cookie
    const sessionPayload = {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
      tenantId: profile.tenant_id || TENANT_ID,
      loggedInAt: new Date().toISOString(),
    };

    cookieStore.set("marketos_admin_session", JSON.stringify(sessionPayload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    await MarketOSRepository.recordAuditLog({
      tenantId: TENANT_ID,
      actorId: profile.id,
      actorName: profile.full_name,
      action: "USER_LOGIN",
      entity: "profiles",
      entityId: profile.id,
      newData: { role: profile.role, email: profile.email },
    });

    return { success: true, profile };
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al iniciar sesión",
    };
  }
}

/**
 * Logout action for Tenant Admin
 */
export async function logoutAdminAction() {
  const cookieStore = await cookies();
  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
  } catch (e) {
    // Ignore sign out error
  }

  cookieStore.delete("marketos_admin_session");
  return { success: true };
}

/**
 * Get currently authenticated admin user from session
 */
export async function getCurrentAdminUser(): Promise<UserProfile | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("marketos_admin_session")?.value;

  if (!sessionCookie) return null;

  try {
    const parsed = JSON.parse(sessionCookie);
    return {
      id: parsed.id,
      tenant_id: parsed.tenantId,
      email: parsed.email,
      full_name: parsed.fullName,
      phone: null,
      avatar_url: null,
      role: parsed.role,
      created_at: parsed.loggedInAt,
      updated_at: parsed.loggedInAt,
    };
  } catch {
    return null;
  }
}
