import fs from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "e96fb9441d9085bf6ebe215d152ec37d";
const accessKeyId = process.env.R2_ACCESS_KEY_ID || "16fd1412b0cb0d4b071c4544ff0880e4";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "da39b83a69bcd9080f03c4000bbb2f3011dc2816952c479d05a9b9866258ee53";
const bucketName = process.env.R2_BUCKET_NAME || "marketos-media";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xiklunkmdpqzlhmrfkql.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

const ARTIFACT_DIR = "/home/lmontes/.gemini/antigravity/brain/7ff13646-e044-433d-b96b-9eef7775a8af";

const PRODUCTS_TO_SEED = [
  {
    id: "d1111111-1111-1111-1111-111111111111",
    name: "Harina PAN Blanca 1kg",
    localFile: "harina_pan_white_1792069746137.jpg",
    r2Key: "shop-market-ca/products/harina-pan-blanca-1kg.jpg",
  },
  {
    id: "d2222222-2222-2222-2222-222222222222",
    name: "Arroz Mary Tradicional 1kg",
    localFile: "arroz_mary_1kg_1792069763508.jpg",
    r2Key: "shop-market-ca/products/arroz-mary-tradicional-1kg.jpg",
  },
  {
    id: "d3333333-3333-3333-3333-333333333333",
    name: "Aceite Vegetal Mazeite 1L",
    localFile: "aceite_mazeite_1l_1792069779948.jpg",
    r2Key: "shop-market-ca/products/aceite-vegetal-mazeite-1l.jpg",
  },
  {
    id: "d4444444-4444-4444-4444-444444444444",
    name: "Café Fama de América 250g",
    localFile: "cafe_fama_america_1792069795956.jpg",
    r2Key: "shop-market-ca/products/cafe-fama-de-america-250g.jpg",
  },
  {
    id: "d5555555-5555-5555-5555-555555555555",
    name: "Queso Paisa Pasteurizado 500g",
    localFile: "queso_paisa_500g_1792069815447.jpg",
    r2Key: "shop-market-ca/products/queso-paisa-pasteurizado-500g.jpg",
  },
  {
    id: "d6666666-6666-6666-6666-666666666666",
    name: "Leche Completa La Campiña 1L",
    localFile: "leche_campina_1l_1792069831940.jpg",
    r2Key: "shop-market-ca/products/leche-completa-la-campina-1l.jpg",
  },
  {
    id: "d7777777-7777-7777-7777-777777777777",
    name: "Coca-Cola Original 1.5L",
    localFile: "coca_cola_15l_1792069850040.jpg",
    r2Key: "shop-market-ca/products/coca-cola-original-1-5l.jpg",
  },
  {
    id: "d8888888-8888-8888-8888-888888888888",
    name: "Galletas Oreo Chocolate 108g",
    localFile: "galletas_oreo_108g_1792069878623.jpg",
    r2Key: "shop-market-ca/products/galletas-oreo-chocolate-108g.jpg",
  },
];

async function main() {
  console.log("=== INICIANDO PRECARGA DE IMÁGENES EN CLOUDFLARE R2 Y SUPABASE ===");

  for (const item of PRODUCTS_TO_SEED) {
    const filePath = path.join(ARTIFACT_DIR, item.localFile);
    if (!fs.existsSync(filePath)) {
      console.error(`✗ Archivo no encontrado: ${filePath}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(filePath);
    console.log(`\nProcesando: ${item.name} (${fileBuffer.length} bytes)...`);

    // 1. Upload to Cloudflare R2
    try {
      await s3.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: item.r2Key,
        Body: fileBuffer,
        ContentType: "image/jpeg",
        Metadata: {
          "tenant-id": "shop-market-ca",
          "uploaded-at": new Date().toISOString(),
        },
      }));
      console.log(`  ✓ Subido exitosamente a Cloudflare R2: ${item.r2Key}`);
    } catch (r2Err) {
      console.error(`  ✗ Error subiendo a R2:`, r2Err.message);
    }

    // 2. Upload backup to Supabase Storage
    try {
      const resSupabase = await fetch(`${supabaseUrl}/storage/v1/object/${bucketName}/${item.r2Key}`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "image/jpeg",
          "x-upsert": "true",
        },
        body: fileBuffer,
      });
      if (resSupabase.ok) {
        console.log(`  ✓ Subido backup a Supabase Storage: ${bucketName}/${item.r2Key}`);
      } else {
        console.warn(`  ⚠ Supabase Storage status ${resSupabase.status}: ${await resSupabase.text()}`);
      }
    } catch (sbErr) {
      console.warn(`  ⚠ Error backup Supabase:`, sbErr.message);
    }

    // 3. Update product in Supabase database
    const finalUrl = `/api/media/${item.r2Key}`;
    try {
      const resUpdate = await fetch(`${supabaseUrl}/rest/v1/products?id=eq.${item.id}`, {
        method: "PATCH",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          image_url: finalUrl,
          updated_at: new Date().toISOString(),
        }),
      });

      if (resUpdate.ok) {
        console.log(`  ✓ Producto actualizado en BD: image_url = "${finalUrl}"`);
      } else {
        console.error(`  ✗ Error actualizando BD:`, await resUpdate.text());
      }
    } catch (dbErr) {
      console.error(`  ✗ Error conectando a BD:`, dbErr.message);
    }
  }

  console.log("\n=== PRECARGA COMPLETADA CON ÉXITO ===");
}

main().catch(console.error);
