import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import StreamArray from 'stream-json/streamers/StreamArray.js';
import Pick from 'stream-json/filters/Pick.js';
import { Chain } from 'stream-chain';
import Parser from 'stream-json/Parser.js';

// Usage: node scripts/seed_supabase.js <path_to_json_file>

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env or environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const jsonFilePath = process.argv[2];

if (!jsonFilePath) {
    console.error('Error: Please provide the path to the USDA JSON file.');
    console.log('Usage: node scripts/seed_supabase.js <path_to_json_file>');
    process.exit(1);
}

async function seedData() {
    const absolutePath = path.resolve(jsonFilePath);
    if (!fs.existsSync(absolutePath)) {
        console.error(`Error: File not found at ${absolutePath}`);
        process.exit(1);
    }

    console.log(`Reading file: ${absolutePath}`);
    console.log('Starting stream processing...');

    let formattedBatch = [];
    const BATCH_SIZE = 200; // Increased batch size slightly
    let processedCount = 0;
    let totalProcessed = 0;

    // We use a promise to handle the stream completion
    await new Promise((resolve, reject) => {
        const pipeline = new Chain([
            fs.createReadStream(absolutePath),
            new Parser(),
            // Pick the array that ends with 'Foods' (FoundationFoods, BrandedFoods, etc.)
            new Pick({ filter: (key) => key.endsWith('Foods') }),
            new StreamArray(),
        ]);

        pipeline.on('data', async (data) => {
            const food = data.value;

            // Extract Macros
            let protein = 0;
            let fat = 0;
            let carbs = 0;
            let calories = 0;

            const nutrients = food.foodNutrients || [];

            for (const nutrient of nutrients) {
                const nutrientId = nutrient.nutrient.id;
                const amount = nutrient.amount;

                // Protein
                if (nutrientId === 1003 || nutrientId === 203) protein = amount;
                // Fat
                if (nutrientId === 1004 || nutrientId === 204) fat = amount;
                // Carbs
                if (nutrientId === 1005 || nutrientId === 205) carbs = amount;
                // Energy
                if (nutrientId === 1008 || nutrientId === 208 || nutrientId === 268 || nutrientId === 269) {
                    calories = amount;
                }
            }

            // Format description for Branded foods
            let description = food.description;
            if (food.brandOwner) {
                description = `${description} (${food.brandOwner})`;
            }

            const foodItem = {
                id: food.fdcId,
                description: description,
                protein,
                fat,
                carbs,
                calories,
                serving_size: 100,
                serving_unit: 'g'
            };

            formattedBatch.push(foodItem);
            totalProcessed++;

            if (formattedBatch.length >= BATCH_SIZE) {
                // Pause stream to process batch
                pipeline.pause();
                const currentBatch = [...formattedBatch];
                formattedBatch = [];

                try {
                    const { error } = await supabase.from('foods').upsert(currentBatch);
                    if (error) {
                        console.error('Error upserting batch:', error);
                    } else {
                        processedCount += currentBatch.length;
                        if (processedCount % 1000 === 0) {
                            console.log(`Processed ${processedCount} items...`);
                        }
                    }
                } catch (e) {
                    console.error("Batch error:", e);
                }

                pipeline.resume();
            }
        });

        pipeline.on('end', async () => {
            // Process remaining
            if (formattedBatch.length > 0) {
                const { error } = await supabase.from('foods').upsert(formattedBatch);
                if (error) {
                    console.error('Error upserting final batch:', error);
                } else {
                    processedCount += formattedBatch.length;
                    console.log(`Processed ${processedCount} items...`);
                }
            }
            console.log(`Seeding complete! Total items found: ${totalProcessed}`);
            resolve();
        });

        pipeline.on('error', (err) => {
            console.error('Stream error:', err);
            reject(err);
        });
    });
}

seedData();
