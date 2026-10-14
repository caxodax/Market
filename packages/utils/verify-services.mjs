import {
  S3Client,
  ListBucketsCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// Color helpers for terminal output
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;

console.log(bold("\n========================================================"));
console.log(bold("   MARKETOS INFRASTRUCTURE DIAGNOSTIC & VERIFICATION   "));
console.log(bold("========================================================\n"));

const results = {
  supabase: { status: "PENDING", details: null, latencyMs: 0 },
  cloudflareR2: { status: "PENDING", details: null, latencyMs: 0 },
};

// ----------------------------------------------------
// 1. SUPABASE POSTGRESQL VERIFICATION
// ----------------------------------------------------
async function testSupabase() {
  const t0 = performance.now();
  console.log(cyan("[1/2] Verificando Supabase..."));
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    throw new Error("Faltan variables NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  console.log(`  - URL: ${url}`);

  // Test A: Anon Key query to products and tenants (RLS test)
  const resTenants = await fetch(`${url}/rest/v1/tenants?select=id,name,slug&limit=5`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  if (!resTenants.ok) {
    const errorText = await resTenants.text();
    throw new Error(`Error consultando tenants (HTTP ${resTenants.status}): ${errorText}`);
  }
  const tenants = await resTenants.json();

  // Test B: Products count
  const resProducts = await fetch(`${url}/rest/v1/products?select=id,name,price_usd&limit=5`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });
  if (!resProducts.ok) {
    const errorText = await resProducts.text();
    throw new Error(`Error consultando products (HTTP ${resProducts.status}): ${errorText}`);
  }
  const products = await resProducts.json();

  // Test C: Exchange Rates
  const resRates = await fetch(`${url}/rest/v1/exchange_rates?select=*`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });
  const rates = resRates.ok ? await resRates.json() : [];

  const latency = Math.round(performance.now() - t0);
  results.supabase = {
    status: "OK",
    latencyMs: latency,
    details: {
      tenantsFound: tenants.length,
      firstTenant: tenants[0]?.name || "N/A",
      productsFound: products.length,
      sampleProduct: products[0]?.name || "N/A",
      exchangeRateVes: rates[0]?.value || "N/A",
      serviceRoleConfigured: !!serviceKey,
    },
  };

  console.log(green(`  ✓ Supabase CONECTADO EXITOSAMENTE (${latency}ms)`));
  console.log(`    • Tenants en BD: ${tenants.length} (Tenant 1: "${tenants[0]?.name}")`);
  console.log(`    • Productos encontrados: ${products.length} (Muestra: "${products[0]?.name}" a $${products[0]?.price_usd})`);
  console.log(`    • Tasa de cambio en BD: Bs. ${rates[0]?.value ?? "No registrada"}`);
}

// ----------------------------------------------------
// 2. CLOUDFLARE R2 OBJECT STORAGE VERIFICATION
// ----------------------------------------------------
async function testCloudflareR2() {
  const t0 = performance.now();
  console.log(cyan("\n[2/2] Verificando Cloudflare R2..."));

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || "marketos-media";

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Faltan variables CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID o R2_SECRET_ACCESS_KEY");
  }

  console.log(`  - Account ID: ${accountId}`);
  console.log(`  - Bucket: ${bucketName}`);

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  // 1. List Buckets
  const { Buckets } = await s3.send(new ListBucketsCommand({}));
  const bucketExists = Buckets?.some((b) => b.Name === bucketName);

  if (!bucketExists) {
    throw new Error(
      `El bucket "${bucketName}" no fue encontrado en la cuenta. Buckets disponibles: ${Buckets?.map((b) => b.Name).join(", ")}`
    );
  }

  // 2. Put Test Object
  const testKey = `system/healthcheck-${Date.now()}.txt`;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: "MarketOS Cloudflare R2 Heartbeat Check",
      ContentType: "text/plain",
      Metadata: {
        verifiedBy: "marketos-diagnostic",
      },
    })
  );

  // 3. Read back
  const getRes = await s3.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: testKey,
    })
  );
  const text = await getRes.Body.transformToString();

  // 4. Delete Test Object
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: testKey,
    })
  );

  const latency = Math.round(performance.now() - t0);
  results.cloudflareR2 = {
    status: "OK",
    latencyMs: latency,
    details: {
      bucket: bucketName,
      allBuckets: Buckets?.map((b) => b.Name),
      verifiedPayload: text,
    },
  };

  console.log(green(`  ✓ Cloudflare R2 CONECTADO EXITOSAMENTE (${latency}ms)`));
  console.log(`    • Bucket activo: "${bucketName}"`);
  console.log(`    • Operaciones S3 validadas: ListBuckets -> PutObject -> GetObject -> DeleteObject`);
  console.log(`    • Latencia de respuesta: ${latency}ms`);
}

// ----------------------------------------------------
// MAIN EXECUTION
// ----------------------------------------------------
async function main() {
  let hasErrors = false;

  try {
    await testSupabase();
  } catch (e) {
    hasErrors = true;
    results.supabase = { status: "FAILED", error: e.message };
    console.error(red(`  ✗ Supabase ERROR: ${e.message}`));
  }

  try {
    await testCloudflareR2();
  } catch (e) {
    hasErrors = true;
    results.cloudflareR2 = { status: "FAILED", error: e.message };
    console.error(red(`  ✗ Cloudflare R2 ERROR: ${e.message}`));
  }

  console.log(bold("\n========================================================"));
  console.log(bold("                   RESUMEN FINAL                        "));
  console.log(bold("========================================================"));

  console.log(`1. Supabase PostgreSQL:   ${results.supabase.status === "OK" ? green("✓ CONECTADO (" + results.supabase.latencyMs + "ms)") : red("✗ FALLÓ")}`);
  console.log(`2. Cloudflare R2 Storage: ${results.cloudflareR2.status === "OK" ? green("✓ CONECTADO (" + results.cloudflareR2.latencyMs + "ms)") : red("✗ FALLÓ")}`);

  if (!hasErrors) {
    console.log(green(bold("\n>>> TODOS LOS SERVICIOS EXTERNOS ESTÁN 100% OPERATIVOS Y CONECTADOS <<<\n")));
    process.exit(0);
  } else {
    console.log(red(bold("\n>>> SE DETECTARON ERRORES EN UNO O MÁS SERVICIOS <<<\n")));
    process.exit(1);
  }
}

main();
