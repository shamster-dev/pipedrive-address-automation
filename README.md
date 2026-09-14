A Next JS automation service that listens to dispatched PipeDrive WebHooks, processes the data into house information via relevant APIs and posts the information back to PipeDrive to autofill house information from an address field within a deal on the pipeline.

---

## Features
- **Webhook Listener**: Securely handles incoming POST requests from Pipedrive.
- **Data Enrichment**: Takes raw address inputs and queries property data APIs.
- **Auto-Update**: Automatically writes the processed house details back into Pipedrive fields.
- **Next.js API Routes**: Built using Next.js serverless/API architecture for easy deployment.

---

## Env

```env
CHIMNIE_API_KEY = ""

PIPEDRIVE_API_KEY = ""
PIPEDRIVE_HOST = ""

REDIS_URL = ""

WEBHOOK_USERNAME = ""
WEBHOOK_PASSWORD = ""
```
