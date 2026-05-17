import fs from 'fs';
import { CollectionImportService } from './src/services/CollectionImportService';

const filePath = 'c:/Users/Gimay/Downloads/EIP Notif API.postman.json';
const json = fs.readFileSync(filePath, 'utf-8');

try {
  const preview = CollectionImportService.previewImport(json);
  console.log(JSON.stringify(preview, null, 2));
} catch (err) {
  console.error('Error:', err);
}
