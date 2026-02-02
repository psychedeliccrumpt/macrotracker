const { execSync } = require('child_process');
const fs = require('fs');

try {
    console.log('Generating SQL...');
    const sql = execSync('npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script', { encoding: 'utf-8' });
    fs.writeFileSync('supabase_schema.sql', sql);
    console.log('SQL generated successfully to supabase_schema.sql');
} catch (e) {
    console.error('Error generating SQL:', e.message);
}
