import { NextRequest, NextResponse } from "next/server";
import { getDataFromAddress } from "./actions"
import redisConnection from "@/lib/redis"

enum NICE_FIELDS {
  "build year" = "c686f71074ec716c2499698cc99fbb524f5b0a07",
  "bedroom count" = "2384df7ed37673d41cc1b07d4b15e468f31b40a7",
  "address" = "ec6975e3106a4cbf110c116651da7eba2017f404",
  "property value" = "3aaf39f6416e798ccd6ee73f12d24b6f128dbc8f",
}

type ADDRESS_FIELD = {
  postal_code: string;
  formatted_address: string,
}

type CUSTOM_FIELDS = {
  ["ec6975e3106a4cbf110c116651da7eba2017f404"]: ADDRESS_FIELD,
  ["c686f71074ec716c2499698cc99fbb524f5b0a07"]: string,
  ["2384df7ed37673d41cc1b07d4b15e468f31b40a7"]: number,
  ["3aaf39f6416e798ccd6ee73f12d24b6f128dbc8f"]: number,
}

const getCustomFieldValue = (customFields: CUSTOM_FIELDS, field: keyof typeof NICE_FIELDS) => {
  return customFields[NICE_FIELDS[field]]
}

const isPresent = (val: unknown) => val !== undefined && val !== null && val !== "";

export async function POST(req: NextRequest) {
  try {
    const headers = await req.headers
    if (!headers || !headers.get("authorization")?.startsWith("Basic")) {
      return NextResponse.json({ error: "No credentials provided" }, {status: 401})
    }

    const base64Credentials = headers.get("authorization")?.split(" ")[1]
    if (!base64Credentials) {
      return NextResponse.json({ error: "No credentials provided" }, {status: 401})
    }

    const credentials = Buffer.from(base64Credentials, "base64").toString("ascii")
    const [username, password] = credentials.split(":")

    if (!username || !password) {
      return NextResponse.json({ error: "No credentials provided" }, {status: 401})
    }

    if (!(username === process.env.WEBHOOK_USERNAME && password === process.env.WEBHOOK_PASSWORD)) {
      return NextResponse.json({ error: "Incorrect details" }, { status: 403 })
    }

    const webhookData: {data: {id: number, custom_fields: CUSTOM_FIELDS}, meta: any} = await req.json()

    if (!getCustomFieldValue(webhookData.data.custom_fields, "address")) {
      return NextResponse.json({ error: "Address is not available" }, { status: 400 })
    }

    const {postal_code, formatted_address} = getCustomFieldValue(webhookData.data.custom_fields, "address") as ADDRESS_FIELD  
    if (!postal_code || !formatted_address) {
      return NextResponse.json({ error: "Address is not available" }, { status: 400 })
    }

    if (
      isPresent(getCustomFieldValue(webhookData.data.custom_fields, "property value"))
      && isPresent(getCustomFieldValue(webhookData.data.custom_fields, "build year"))
      && isPresent(getCustomFieldValue(webhookData.data.custom_fields, "bedroom count"))
    ) {
      return NextResponse.json({ error: "All data is available" }, { status: 200 })
    }

    const dealId = webhookData.data.id;
    const lockKey = `lock:deal:${dealId}`;

    try {
      const acquired = await redisConnection.set(lockKey, "processing", {
        NX: true,
        EX: 30,
      });

      if (!acquired) {
        console.log(`Already processing deal ${dealId}`);
        return NextResponse.json({ error: "Already processing deal" }, { status: 200 });
      }
    } catch (lockErr) {
      console.warn("Redis lock error:", lockErr);
    }

    const propertyData: {
      property?: {
        attributes?: {
          status?: { date_of_construction_declared_and_predicted?: string | number };
          indoor?: { bedrooms_declared_and_predicted?: number };
        };
        value?: {
          sale?: {
            property_value_range?: [number, number]
          };
        };
      };
    } = await getDataFromAddress(formatted_address)

    if (!propertyData) {
      return NextResponse.json({ error: "Address not found" }, { status: 400 })
    }

    let payload: Record<string, any> = {}

    if (!isPresent(getCustomFieldValue(webhookData.data.custom_fields, "property value"))) {
      const valRange = propertyData.property?.value?.sale?.property_value_range
      if (valRange && valRange.length == 2) {
        payload[NICE_FIELDS["property value"]] = `${valRange[0]} - ${valRange[1]}`
      }
    }

    if (!isPresent(getCustomFieldValue(webhookData.data.custom_fields, "build year"))) {
      const buildYear = propertyData.property?.attributes?.status?.date_of_construction_declared_and_predicted
      if (isPresent(buildYear)) {
        payload[NICE_FIELDS["build year"]] = String(buildYear)
      }
    }

    if (!isPresent(getCustomFieldValue(webhookData.data.custom_fields, "bedroom count"))) {
      const bedroomCount = propertyData.property?.attributes?.indoor?.bedrooms_declared_and_predicted
      if (isPresent(bedroomCount)) {
        payload[NICE_FIELDS["bedroom count"]] = Number(bedroomCount)
      } 
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "No data to report" }, { status: 200 })
    }

    const response = await fetch(`https://${process.env.PIPEDRIVE_HOST}.pipedrive.com/api/v2/deals/${webhookData.data.id}`, {
      method: "PATCH",
      headers: {
        ["Content-Type"]: "application/json",
        ["Accept"]: "application/json",
        ["x-api-token"]: process.env.PIPEDRIVE_API_KEY
      } as HeadersInit,
      body: JSON.stringify({
        custom_fields: payload,
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log("Deal successfully updated");
      console.log(payload)
    } else {
      console.error("Failed to update deal:", result);
      return NextResponse.json({}, {status: 502});
    }

    return NextResponse.json({}, {status: 200});
  } catch (error) {
    console.log(error)
    return NextResponse.json({}, {status: 500});
  }
}