"use server";

import { cookies } from "next/headers";
import { MarketOSRepository, createServerComponentClient } from "@marketos/database";
import { signSessionPayload, verifySessionPayload } from "@marketos/auth";
import { UserProfile, UserRole } from "@marketos/types";

const TENANT_ID = process.env.DEFAULT_TENANT_ID || "shop-market-ca";

/**
 * Creates Supabase SSR client with async cookies for Next.js 16
 */
async function getSupabaseServerClient() {
  const cookieStore = await cookies();
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
 * Unified login action: validates credentials and determines redirect path by role
 */
export async function loginUserAction(email: string, password?: string) {
  const cookieStore = await cookies();
  const cleanEmail = email.toLowerCase().trim();

  try {
    const isDemoAllowed =
      process.env.NODE_ENV !== "production" ||
      process.env.ALLOW_DEMO_LOGIN === "true";

    if (!isDemoAllowed && !password) {
      return {
        success: false,
        error: "La contraseña es requerida.",
      };
    }

    const supabase = await getSupabaseServerClient();
    if (!isDemoAllowed && !supabase) {
      return {
        success: false,
        error: "Servicio de autenticación no disponible.",
      };
    }

    let authUserId: string | null = null;

    // 1. Try Supabase Auth password sign-in if password provided
    if (supabase && password) {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (authError) {
        console.warn(`[MarketOS Auth] Invalid password attempt for ${cleanEmail}: ${authError.message}`);
        return {
          success: false,
          error: "Credenciales inválidas o contraseña incorrecta.",
        };
      }

      if (authData.user) {
        authUserId = authData.user.id;
      }
    }

    if (!isDemoAllowed && !authUserId) {
      return {
        success: false,
        error: "Autenticación fallida o credenciales inválidas.",
      };
    }

    // 2. Fetch User Profile
    let profile: UserProfile | null = null;
    if (authUserId) {
      profile = await MarketOSRepository.getUserProfile(authUserId);
    }
    if (!profile) {
      profile = await MarketOSRepository.getUserProfile(cleanEmail);
    }

    // 3. Fallback defaults for demo accounts (STRICTLY non-production or explicit demo flag)
    if (!profile && isDemoAllowed) {
      if (
        cleanEmail === "superadmin@marketos.com" ||
        cleanEmail === "admin@marketos.platform"
      ) {
        profile = {
          id: "usr-super-admin-01",
          tenant_id: null,
          email: cleanEmail,
          full_name: "Super Admin Maestro",
          phone: "+58 412-0000000",
          avatar_url: null,
          role: "PLATFORM_SUPER_ADMIN",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      } else if (
        cleanEmail === "owner@shopmarket.com" ||
        cleanEmail === "admin@shopmarket.com"
      ) {
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
      } else if (cleanEmail === "gerente@shopmarket.com") {
        profile = {
          id: "usr-mgr-shop-market",
          tenant_id: TENANT_ID,
          email: cleanEmail,
          full_name: "María Rodríguez (Encargada)",
          phone: "+58 414-5551234",
          avatar_url: null,
          role: "TENANT_MANAGER",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      } else if (cleanEmail === "caja@shopmarket.com") {
        profile = {
          id: "usr-cashier-shop-market",
          tenant_id: TENANT_ID,
          email: cleanEmail,
          full_name: "Carlos Pérez (Cajero)",
          phone: "+58 412-5559876",
          avatar_url: null,
          role: "TENANT_CASHIER",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
    }

    if (!profile) {
      return {
        success: false,
        error: "Credenciales inválidas o usuario no registrado.",
      };
    }

    // 4. Determine smart destination based on role
    let redirectTo = "/";
    if (profile.role === "PLATFORM_SUPER_ADMIN") {
      redirectTo = "/platform";
    } else if (
      [
        "TENANT_OWNER",
        "TENANT_MANAGER",
        "TENANT_CASHIER",
        "TENANT_INVENTORY",
        "TENANT_DELIVERY",
      ].includes(profile.role)
    ) {
      redirectTo = "/admin";
    }

    // 5. Store session in unified cookie
    const sessionPayload = {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
      tenantId: profile.tenant_id || TENANT_ID,
      loggedInAt: new Date().toISOString(),
    };

    const signedToken = signSessionPayload(sessionPayload);

    cookieStore.set("marketos_session", signedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    // Also set legacy cookie for compatibility
    cookieStore.set("marketos_admin_session", signedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    await MarketOSRepository.recordAuditLog({
      tenantId: profile.tenant_id || "platform",
      actorId: profile.id,
      actorName: profile.full_name,
      action: "USER_LOGIN",
      entity: "profiles",
      entityId: profile.id,
      newData: { role: profile.role, email: profile.email, redirectTo },
    });

    return { success: true, profile, redirectTo };
  } catch (error) {
    console.error("Unified login error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al iniciar sesión",
    };
  }
}

/**
 * Unified logout action
 */
export async function logoutUserAction() {
  const cookieStore = await cookies();
  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
  } catch (e) {
    // Ignore sign out error
  }

  cookieStore.delete("marketos_session");
  cookieStore.delete("marketos_admin_session");
  cookieStore.delete("marketos_super_admin_session");
  cookieStore.delete("marketos_impersonation");
  return { success: true };
}

/**
 * Get currently authenticated user from unified session cookie
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const cookieStore = await cookies();
  const sessionCookie =
    cookieStore.get("marketos_session")?.value ||
    cookieStore.get("marketos_admin_session")?.value ||
    cookieStore.get("marketos_super_admin_session")?.value;

  if (!sessionCookie) return null;

  try {
    const parsed = verifySessionPayload<{
      id: string;
      email: string;
      fullName: string;
      role: UserRole;
      tenantId: string;
      loggedInAt: string;
    }>(sessionCookie);

    if (!parsed) return null;

    // Check for active support impersonation session
    const impersonationCookie = cookieStore.get("marketos_impersonation")?.value;
    let impersonation = null;
    if (impersonationCookie) {
      impersonation = verifySessionPayload<any>(impersonationCookie);
    }

    return {
      id: parsed.id,
      tenant_id: impersonation ? impersonation.targetTenantId : (parsed.tenantId || null),
      email: parsed.email,
      full_name: parsed.fullName,
      phone: null,
      avatar_url: null,
      role: parsed.role,
      created_at: parsed.loggedInAt,
      updated_at: parsed.loggedInAt,
      impersonation,
    };
  } catch {
    return null;
  }
}
