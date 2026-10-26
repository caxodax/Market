"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  PlatformSettings,
  UpdatePlatformSettingsInput,
  UserProfile,
  PluginDependencyRule,
  PluginDependencyType,
  TenantModuleId,
  DEFAULT_PLUGIN_DEPENDENCY_RULES,
} from "@marketos/types";
import { formatMediaUrl } from "@marketos/utils";
import {
  updatePlatformSettingsAction,
  uploadPlatformLogoAction,
  updateUserProfileAction,
} from "../app/platform/actions";
import { AVAILABLE_PLUGINS } from "./tenant-plugins-modal";
import {
  Sliders,
  Building2,
  Phone,
  Mail,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  User,
  Trash2,
  DollarSign,
  MessageSquare,
  Globe,
  Info,
  GitFork,
  ArrowRight,
  ShieldAlert,
  Plus,
  Zap,
  Ban,
  RotateCcw,
  Boxes,
  Check,
} from "lucide-react";

interface PlatformSettingsTabProps {
  initialSettings: PlatformSettings;
  currentUser: UserProfile;
  onSettingsUpdated?: (settings: PlatformSettings) => void;
  onProfileUpdated?: (user: UserProfile) => void;
}

export function PlatformSettingsTab({
  initialSettings,
  currentUser,
  onSettingsUpdated,
  onProfileUpdated,
}: PlatformSettingsTabProps) {
  const [isPending, startTransition] = useTransition();

  // Platform White-Label Settings State
  const [platformName, setPlatformName] = useState(initialSettings.platform_name || "MarketOS");
  const [platformTagline, setPlatformTagline] = useState(
    initialSettings.platform_tagline || "Consola Centralizada Multi-Tenant SaaS"
  );
  const [logoUrl, setLogoUrl] = useState(
    initialSettings.logo_url ? formatMediaUrl(initialSettings.logo_url) : ""
  );
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [supportPhone, setSupportPhone] = useState(initialSettings.support_phone || "");
  const [supportWhatsapp, setSupportWhatsapp] = useState(initialSettings.support_whatsapp || "");
  const [supportEmail, setSupportEmail] = useState(initialSettings.support_email || "");
  const [currencySymbol, setCurrencySymbol] = useState(initialSettings.currency_symbol || "$");
  const [contactAddress, setContactAddress] = useState(initialSettings.contact_address || "");

  // Plugin Dependency & Default Modules State
  const [dependencyRules, setDependencyRules] = useState<PluginDependencyRule[]>(
    initialSettings.plugin_dependency_rules && initialSettings.plugin_dependency_rules.length > 0
      ? initialSettings.plugin_dependency_rules
      : DEFAULT_PLUGIN_DEPENDENCY_RULES
  );
  const [defaultModules, setDefaultModules] = useState<TenantModuleId[]>(
    initialSettings.default_tenant_modules && initialSettings.default_tenant_modules.length > 0
      ? initialSettings.default_tenant_modules
      : ["local_venezuela", "invoicing", "purchasing_retentions"]
  );

  // New Rule Form State
  const [showAddRule, setShowAddRule] = useState(false);
  const [newSourceModule, setNewSourceModule] = useState<TenantModuleId>("invoicing");
  const [newTargetModule, setNewTargetModule] = useState<TenantModuleId>("purchasing_retentions");
  const [newRuleType, setNewRuleType] = useState<PluginDependencyType>("AUTO_ACTIVATE");
  const [newRuleDesc, setNewRuleDesc] = useState("");

  const handleToggleDefaultModule = (modId: TenantModuleId) => {
    setDefaultModules((prev) =>
      prev.includes(modId) ? prev.filter((id) => id !== modId) : [...prev, modId]
    );
  };

  const handleToggleRuleStatus = (ruleId: string) => {
    setDependencyRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, is_active: !r.is_active } : r))
    );
  };

  const handleDeleteRule = (ruleId: string) => {
    setDependencyRules((prev) => prev.filter((r) => r.id !== ruleId));
  };

  const handleAddRule = () => {
    if (newSourceModule === newTargetModule) {
      setErrorMessage("El plugin de origen y destino no pueden ser el mismo.");
      return;
    }
    const newRule: PluginDependencyRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      source_module_id: newSourceModule,
      target_module_id: newTargetModule,
      type: newRuleType,
      description: newRuleDesc.trim() || undefined,
      is_active: true,
    };
    setDependencyRules((prev) => [...prev, newRule]);
    setNewRuleDesc("");
    setShowAddRule(false);
  };

  const handleRestoreDefaultRules = () => {
    setDependencyRules([...DEFAULT_PLUGIN_DEPENDENCY_RULES]);
  };

  // Super Admin Personal Profile State
  const [adminFullName, setAdminFullName] = useState(currentUser.full_name || "");
  const [adminPhone, setAdminPhone] = useState(currentUser.phone || "");

  // UI Feedback states
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState<string | null>(null);
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null);

  // Sincronizar Favicon y Título en la pestaña del navegador en tiempo real
  useEffect(() => {
    const effective = formatMediaUrl(logoUrl);
    if (effective && !logoLoadError) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = effective;
    }
    if (platformName) {
      document.title = `${platformName} Master | Consola Centralizada`;
    }
  }, [logoUrl, platformName, logoLoadError]);

  // Logo upload handler
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Previsualización instantánea local sin parpadeos
    const instantPreview = URL.createObjectURL(file);
    setLogoUrl(instantPreview);
    setLogoLoadError(false);

    setIsUploadingLogo(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await uploadPlatformLogoAction(formData);
      if (res.success && res.url) {
        const cleanUrl = formatMediaUrl(res.url);
        setLogoUrl(cleanUrl);
        setLogoLoadError(false);
        setSuccessMessage("Logotipo subido y enlazado exitosamente");
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setSuccessMessage("Previsualización de imagen cargada localmente");
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch {
      setErrorMessage("Error al procesar la imagen del logotipo");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Save Platform Settings
  const handleSavePlatformSettings = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const payload: UpdatePlatformSettingsInput = {
          platform_name: platformName.trim() || "MarketOS",
          platform_tagline: platformTagline.trim(),
          logo_url: logoUrl.trim() || null,
          support_phone: supportPhone.trim() || null,
          support_whatsapp: supportWhatsapp.trim() || supportPhone.trim() || null,
          support_email: supportEmail.trim() || null,
          currency_symbol: currencySymbol.trim() || "$",
          contact_address: contactAddress.trim() || null,
          plugin_dependency_rules: dependencyRules,
          default_tenant_modules: defaultModules,
        };

        const res = await updatePlatformSettingsAction(payload);
        if (res.success && res.settings) {
          setSuccessMessage("¡Ajustes de Plataforma actualizados exitosamente!");
          onSettingsUpdated?.(res.settings);
          setTimeout(() => setSuccessMessage(null), 5000);
        } else {
          setErrorMessage(res.error || "No se pudieron guardar los ajustes");
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Error inesperado al guardar ajustes"
        );
      }
    });
  };

  // Save Super Admin Profile (Name and personal phone)
  const handleSaveAdminProfile = async () => {
    setIsSavingProfile(true);
    setProfileErrorMessage(null);
    setProfileSuccessMessage(null);

    try {
      const res = await updateUserProfileAction(currentUser.id, {
        full_name: adminFullName.trim(),
        phone: adminPhone.trim() || null,
      });

      if (res.success && res.user) {
        setProfileSuccessMessage("¡Tus datos de Super Admin han sido actualizados!");
        onProfileUpdated?.(res.user);
        setTimeout(() => setProfileSuccessMessage(null), 5000);
      } else {
        setProfileErrorMessage(res.error || "Error al actualizar perfil de Super Admin");
      }
    } catch (err) {
      setProfileErrorMessage(
        err instanceof Error ? err.message : "Error al actualizar perfil"
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Helper for WhatsApp test link
  const cleanPhoneForWhatsApp = (phone: string) => {
    return phone.replace(/[^\d]/g, "");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner / Heading */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-card via-card to-muted/40 border border-border shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 mb-2">
            <Sliders className="w-3.5 h-3.5" />
            <span>Configuración Matriz SaaS</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground">
            Ajustes de Plataforma
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Gestiona la identidad visual (marca blanca), el logo oficial de la empresa matriz y los canales de contacto y soporte oficiales que ven los comercios.
          </p>
        </div>

        <button
          onClick={handleSavePlatformSettings}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-bold shadow-md hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Guardando...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Guardar Ajustes</span>
            </>
          )}
        </button>
      </div>

      {/* Global Alerts */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="text-sm font-bold">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-bold">{errorMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COL 1 & 2: Main Configuration Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* CARD 1: IDENTIDAD CORPORATIVA & LOGO */}
          <div className="p-6 rounded-3xl border border-border bg-card shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Identidad de Marca & Logotipo
                </h3>
                <p className="text-xs text-muted-foreground">
                  Personaliza cómo se muestra el nombre y logo del software en la consola y portales
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Nombre Comercial del SaaS / Plataforma
                </label>
                <input
                  type="text"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  placeholder="ej. MarketOS"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                />
                <p className="text-[11px] text-muted-foreground">
                  Aparecerá en el encabezado superior y en las comunicaciones oficiales.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Eslogan o Subtítulo del Panel
                </label>
                <input
                  type="text"
                  value={platformTagline}
                  onChange={(e) => setPlatformTagline(e.target.value)}
                  placeholder="ej. Consola Centralizada Multi-Tenant SaaS"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                />
                <p className="text-[11px] text-muted-foreground">
                  Texto descriptivo debajo del título de la consola.
                </p>
              </div>
            </div>

            {/* LOGO UPLOAD & MANAGEMENT */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-foreground flex items-center gap-2">
                <span>Logotipo Oficial de la Plataforma</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  (PNG, SVG o WebP recomendado con fondo transparente)
                </span>
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl border border-dashed border-border bg-muted/20">
                {/* Logo Display Box */}
                <div className="w-20 h-20 rounded-2xl border border-border bg-card flex items-center justify-center p-2 shrink-0 shadow-xs relative overflow-hidden">
                  {logoUrl && !logoLoadError ? (
                    <img
                      src={formatMediaUrl(logoUrl)}
                      alt="Logo de Plataforma"
                      className="w-full h-full object-contain"
                      onError={() => setLogoLoadError(true)}
                    />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-2xl tracking-tighter">
                      {platformName ? platformName.charAt(0).toUpperCase() : "M"}
                    </div>
                  )}
                </div>

                {/* Upload Buttons */}
                <div className="flex-1 space-y-2 w-full text-center sm:text-left">
                  <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold cursor-pointer transition-colors">
                      {isUploadingLogo ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      <span>{isUploadingLogo ? "Subiendo..." : "Subir Nuevo Logo"}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={handleLogoUpload}
                        disabled={isUploadingLogo}
                      />
                    </label>

                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoUrl("")}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Restablecer</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    <input
                      type="url"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="O pega una URL externa directa: https://.../logo.png"
                      className="w-full px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* CURRENCY & ADDRESS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Símbolo de Moneda Base del SaaS</span>
                </label>
                <input
                  type="text"
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  placeholder="$"
                  maxLength={5}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold"
                />
                <p className="text-[11px] text-muted-foreground">
                  Utilizado para planes, facturas y métricas de suscripción.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Sede u Oficina Matriz (Opcional)</span>
                </label>
                <input
                  type="text"
                  value={contactAddress}
                  onChange={(e) => setContactAddress(e.target.value)}
                  placeholder="ej. Torre Empresarial, Piso 10"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                />
                <p className="text-[11px] text-muted-foreground">
                  Información para pie de página y recibos emitidos a clientes.
                </p>
              </div>
            </div>
          </div>

          {/* CARD 2: CANALES DE ATENCIÓN & NÚMERO DE LA EMPRESA */}
          <div className="p-6 rounded-3xl border border-border bg-card shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Canales Oficiales de Atención y Soporte
                </h3>
                <p className="text-xs text-muted-foreground">
                  El número y correo de contacto de tu empresa para atender a los dueños de tiendas
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* WhatsApp Oficial de Soporte */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                    <span>WhatsApp Oficial de Soporte</span>
                  </span>
                  {supportWhatsapp && (
                    <a
                      href={`https://wa.me/${cleanPhoneForWhatsApp(supportWhatsapp)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-500 hover:underline flex items-center gap-1"
                    >
                      <span>Probar chat</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </label>
                <input
                  type="tel"
                  value={supportWhatsapp}
                  onChange={(e) => setSupportWhatsapp(e.target.value)}
                  placeholder="ej. +58 414 1234567 o +1 305 0000000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Canal directo donde los comercios solicitarán soporte y activación de módulos.
                </p>
              </div>

              {/* Teléfono de Llamadas / PBX */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Teléfono Master / Atención Telefónica</span>
                </label>
                <input
                  type="tel"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  placeholder="ej. +58 212 0000000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Línea fija o conmutador de la empresa matriz.
                </p>
              </div>

              {/* Correo Electrónico de Soporte */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Correo Electrónico de Soporte & Facturación SaaS</span>
                </label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="ej. contacto@tuempresa.com o soporte@marketos.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                />
                <p className="text-[11px] text-muted-foreground">
                  Dirección donde los comercios remitirán dudas y comprobantes bancarios de suscripción.
                </p>
              </div>
            </div>
          </div>

          {/* CARD 3: PLUGINS POR DEFECTO PARA NUEVAS TIENDAS */}
          <div className="p-6 rounded-3xl border border-border bg-card shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      Plugins por Defecto para Nuevas Tiendas
                    </h3>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      {defaultModules.length} Activos
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Módulos pre-instalados automáticamente al incorporar o registrar un nuevo comercio
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Selecciona qué plugins vendrán encendidos de fábrica en cada nueva tienda. Los administradores de cada comercio podrán luego solicitar la activación o desactivación de módulos adicionales según su plan.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AVAILABLE_PLUGINS.map((plugin) => {
                const isSelected = defaultModules.includes(plugin.id);
                return (
                  <button
                    key={plugin.id}
                    type="button"
                    onClick={() => handleToggleDefaultModule(plugin.id)}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary/5 border-primary/40 shadow-xs ring-1 ring-primary/20"
                        : "bg-background/60 hover:bg-muted/40 border-border text-muted-foreground"
                    }`}
                  >
                    <div className="shrink-0 mt-0.5 p-2 rounded-xl bg-card border border-border shadow-xs">
                      {plugin.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span
                          className={`text-xs font-bold truncate ${
                            isSelected ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {plugin.name}
                        </span>
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-border bg-muted/40 shrink-0" />
                        )}
                      </div>
                      <span className="inline-block text-[10px] font-semibold text-muted-foreground mt-0.5">
                        {plugin.categoryShort}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CARD 4: MATRIZ DE DEPENDENCIAS E INCOMPATIBILIDADES */}
          <div className="p-6 rounded-3xl border border-border bg-card shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
                  <GitFork className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      Matriz de Dependencias de Plugins
                    </h3>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      {dependencyRules.filter((r) => r.is_active).length} Reglas Activas
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Reglas que gobiernan auto-activación, dependencias y conflictos territoriales entre plugins
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleRestoreDefaultRules}
                  title="Restaurar reglas de fábrica"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Restaurar Fábrica</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddRule(!showAddRule)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Regla</span>
                </button>
              </div>
            </div>

            {/* ADD RULE INLINE FORM */}
            {showAddRule && (
              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <span className="text-xs font-black uppercase text-foreground tracking-wide">
                    Nueva Regla de Dependencia
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddRule(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Origen */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground">
                      Plugin Origen
                    </label>
                    <select
                      value={newSourceModule}
                      onChange={(e) => setNewSourceModule(e.target.value as TenantModuleId)}
                      className="w-full px-3 py-2 rounded-xl border border-input bg-background text-xs font-medium text-foreground focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer"
                    >
                      {AVAILABLE_PLUGINS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tipo de Relación */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground">
                      Tipo de Relación
                    </label>
                    <select
                      value={newRuleType}
                      onChange={(e) => setNewRuleType(e.target.value as PluginDependencyType)}
                      className="w-full px-3 py-2 rounded-xl border border-input bg-background text-xs font-bold text-foreground focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer"
                    >
                      <option value="AUTO_ACTIVATE">⚡ Auto-Activar (Cascada)</option>
                      <option value="REQUIRES">🛡️ Requiere Obligatoriamente</option>
                      <option value="CONFLICTS">🚫 Conflicto / Incompatible</option>
                    </select>
                  </div>

                  {/* Destino */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground">
                      Plugin Afectado / Requerido
                    </label>
                    <select
                      value={newTargetModule}
                      onChange={(e) => setNewTargetModule(e.target.value as TenantModuleId)}
                      className="w-full px-3 py-2 rounded-xl border border-input bg-background text-xs font-medium text-foreground focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer"
                    >
                      {AVAILABLE_PLUGINS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Descripción */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground">
                    Descripción / Motivo de la regla (opcional)
                  </label>
                  <input
                    type="text"
                    value={newRuleDesc}
                    onChange={(e) => setNewRuleDesc(e.target.value)}
                    placeholder="ej. Facturación requiere compras para retenciones de IVA..."
                    className="w-full px-3 py-2 rounded-xl border border-input bg-background text-xs font-medium text-foreground focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddRule}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Guardar Regla</span>
                  </button>
                </div>
              </div>
            )}

            {/* RULES LIST */}
            <div className="space-y-2.5">
              {dependencyRules.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-border text-muted-foreground space-y-3">
                  <GitFork className="w-8 h-8 mx-auto opacity-40" />
                  <p className="text-xs">No hay reglas de dependencia configuradas.</p>
                  <button
                    type="button"
                    onClick={handleRestoreDefaultRules}
                    className="px-3 py-1.5 rounded-xl bg-muted text-xs font-bold text-foreground hover:bg-muted/80"
                  >
                    Cargar Reglas de Fábrica
                  </button>
                </div>
              ) : (
                dependencyRules.map((rule) => {
                  const source = AVAILABLE_PLUGINS.find((p) => p.id === rule.source_module_id);
                  const target = AVAILABLE_PLUGINS.find((p) => p.id === rule.target_module_id);

                  return (
                    <div
                      key={rule.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                        rule.is_active
                          ? "bg-card border-border shadow-xs"
                          : "bg-muted/20 border-border/60 opacity-60"
                      }`}
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Source Module */}
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-foreground text-xs font-bold">
                            {source?.icon}
                            <span className="truncate max-w-[140px] sm:max-w-none">
                              {source?.name || rule.source_module_id}
                            </span>
                          </div>

                          {/* Rule Badge */}
                          {rule.type === "AUTO_ACTIVATE" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase">
                              <Zap className="w-3 h-3" />
                              Auto-Activa
                            </span>
                          )}
                          {rule.type === "REQUIRES" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-black uppercase">
                              <ShieldAlert className="w-3 h-3" />
                              Requiere
                            </span>
                          )}
                          {rule.type === "CONFLICTS" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-black uppercase">
                              <Ban className="w-3 h-3" />
                              Conflicto Mutuo
                            </span>
                          )}

                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 hidden sm:inline" />

                          {/* Target Module */}
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-foreground text-xs font-bold">
                            {target?.icon}
                            <span className="truncate max-w-[140px] sm:max-w-none">
                              {target?.name || rule.target_module_id}
                            </span>
                          </div>
                        </div>

                        {rule.description && (
                          <p className="text-[11px] text-muted-foreground leading-relaxed pl-1">
                            {rule.description}
                          </p>
                        )}
                      </div>

                      {/* Rule Actions */}
                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleRuleStatus(rule.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            rule.is_active
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {rule.is_active ? "Regla Activa" : "Desactivada"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          title="Eliminar regla"
                          className="p-1.5 rounded-xl hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* COL 3: PREVIEW & SUPER ADMIN PROFILE */}
        <div className="space-y-6">
          {/* LIVE PREVIEW BOX */}
          <div className="p-6 rounded-3xl border border-border bg-card shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Vista Previa en Vivo</span>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-background space-y-3">
              <span className="text-[10px] font-mono text-muted-foreground uppercase">
                Header del Super Admin
              </span>
              <div className="flex items-center gap-3">
                {logoUrl && !logoLoadError ? (
                  <img
                    src={formatMediaUrl(logoUrl)}
                    alt={platformName}
                    className="h-10 w-10 rounded-xl object-contain bg-card border border-border p-1 shadow-xs shrink-0"
                    onError={() => setLogoLoadError(true)}
                  />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-xl shadow-xs shrink-0 tracking-tighter">
                    {platformName ? platformName.charAt(0).toUpperCase() : "M"}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-sm tracking-tight text-foreground truncate">
                      {platformName || "MarketOS"} Master
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.2 rounded-full">
                      Admin
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {platformTagline || "Consola Centralizada Multi-Tenant SaaS"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-muted/40 border border-border text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <Info className="w-4 h-4 text-primary" />
                <span>Impacto de estos ajustes</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Al guardar, la cabecera superior y todos los accesos del sistema reflejarán el nombre y logo de tu empresa en tiempo real sin necesidad de reiniciar la aplicación.
              </p>
            </div>
          </div>

          {/* CARD 3: PERFIL DEL SUPER ADMINISTRADOR MAESTRO */}
          <div className="p-6 rounded-3xl border border-border bg-card shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Mi Perfil de Super Admin
                </h3>
                <p className="text-xs text-muted-foreground">
                  Actualiza tu nombre y número personal para reemplazar el de prueba
                </p>
              </div>
            </div>

            {profileSuccessMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{profileSuccessMessage}</span>
              </div>
            )}

            {profileErrorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{profileErrorMessage}</span>
              </div>
            )}

            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  placeholder="Tu Nombre y Apellido"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">
                  Teléfono Móvil Personal
                </label>
                <input
                  type="tel"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  placeholder="ej. +58 412 1234567"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Reemplazará el teléfono provisional (+58 412-0000000) en el directorio de usuarios.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">
                  Correo del Administrador
                </label>
                <input
                  type="email"
                  value={currentUser.email}
                  disabled
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-muted text-sm text-muted-foreground font-mono cursor-not-allowed"
                />
                <p className="text-[10px] text-muted-foreground">
                  Vinculado a la cuenta maestra de autenticación.
                </p>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Nivel de Acceso</span>
                  </div>
                  <span className="font-mono text-[10px] bg-purple-600 text-white font-black px-2 py-0.5 rounded-md">
                    PLATFORM_SUPER_ADMIN
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveAdminProfile}
                disabled={isSavingProfile}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-background text-xs font-bold hover:bg-foreground/90 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSavingProfile ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Actualizando perfil...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Actualizar mis datos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
