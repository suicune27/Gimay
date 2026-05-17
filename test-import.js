import { CollectionImportService } from './src/services/CollectionImportService';

const json = `{
    "info": {
        "name": "EIP",
        "description": "EIP Project Main Collection",
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    "item": [
        {
            "name": "Sanction Screening",
            "description": "",
            "item": [
                {
                    "name": "UAT",
                    "description": "",
                    "item": [
                        {
                            "name": "Send Notification API",
                            "description": "",
                            "event": [],
                            "auth": {},
                            "request": {
                                "auth": {},
                                "method": "POST",
                                "body": {
                                    "mode": "raw",
                                    "raw": "{\r\n    \"notificationId\": \"2629709-2023-10-02-19-56-33-321\",\r\n    \"accountId\": 1011,\r\n    \"datasetId\": 1050,\r\n    \"caseId\": 2629709,\r\n    \"eventTimestamp\": 1696276716,\r\n    \"events\": [\r\n        \"GWL.subcase.status.updated\"\r\n    ]\r\n}",
                                    "options": {
                                        "raw": {
                                            "language": "json"
                                        }
                                    }
                                },
                                "header": [
                                    {
                                        "key": "x-cb-partner-id",
                                        "value": "DRS",
                                        "description": "https://localhost:7278/api/eip/callback",
                                        "type": "string"
                                    },
                                    {
                                        "key": "x-cb-session-id",
                                        "value": "{{session_id}}",
                                        "description": "https://cbc-eip-appservice-uat-26.azurewebsites.net/api/eip/callback",
                                        "type": "string"
                                    },
                                    {
                                        "key": "x-cb-signature",
                                        "value": "{{signature}}",
                                        "description": "https://gateway.dev.connect.chinabank.ph/eip/sanction/v1/notifcallback",
                                        "type": "string"
                                    },
                                    {
                                        "key": "Authorization",
                                        "value": "{{bearer_token}}",
                                        "description": "https://api.sandbox.connect.chinabank.ph/eip/sanction/v1/notifcallback",
                                        "type": "string"
                                    },
                                    {
                                        "key": "Ocp-Apim-Subscription-Key",
                                        "value": "{{sub_key}}",
                                        "description": "",
                                        "type": "string"
                                    },
                                    {
                                        "key": "x-cb-request-dt",
                                        "value": "{{request_dt}}",
                                        "description": "",
                                        "type": "string"
                                    },
                                    {
                                        "key": "x-cb-clientcert",
                                        "value": "DUMMY",
                                        "description": "",
                                        "type": "string"
                                    }
                                ],
                                "url": {
                                    "raw": "https://api.sandbox.connect.chinabank.ph/eip/sanction/v1/notifcallback",
                                    "path": [
                                        "eip",
                                        "sanction",
                                        "v1",
                                        "notifcallback"
                                    ],
                                    "host": [
                                        "api",
                                        "sandbox",
                                        "connect",
                                        "chinabank",
                                        "ph"
                                    ],
                                    "protocol": "https",
                                    "query": [],
                                    "variable": []
                                }
                            },
                            "response": [],
                            "protocolProfileBehavior": {
                                "strictSSL": false,
                                "followRedirects": true
                            }
                        }
                    ],
                    "event": [
                        {
                            "listen": "prerequest",
                            "script": {
                                "exec": [],
                                "type": "text/javascript",
                                "packages": {}
                            }
                        },
                        {
                            "listen": "test",
                            "script": {
                                "exec": [],
                                "type": "text/javascript",
                                "packages": {}
                            }
                        }
                    ],
                    "auth": {}
                }
            ],
            "event": [
                {
                    "listen": "prerequest",
                    "script": {
                        "exec": [],
                        "type": "text/javascript",
                        "packages": {}
                            }
                        },
                        {
                            "listen": "test",
                            "script": {
                                "exec": [],
                                "type": "text/javascript",
                                "packages": {}
                            }
                        }
                    ],
                    "auth": {}
                }
            ],
            "variable": [],
            "event": [],
            "auth": {}
        }`;

try {
  const preview = CollectionImportService.previewImport(json);
  console.log('Preview:', JSON.stringify(preview, null, 2));
} catch (error) {
  console.error('Error:', error.message);
}