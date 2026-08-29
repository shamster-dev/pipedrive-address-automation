import { NextRequest, NextResponse } from "next/server";
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

const getCustomFieldValue = (customFields: CUSTOM_FIELDS, field: "build year" | "bedroom count" | "address" | "property value") => {
  return customFields[NICE_FIELDS[field]]
}

export async function POST(req: NextRequest) {
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

  if (!(username == "testing" && password == "testing")) {
    return NextResponse.json({ error: "Incorrect details" }, { status: 403 })
  }

  const webhookData: {data: {id: number, custom_fields: CUSTOM_FIELDS}, meta: any} = await req.json()

  if (getCustomFieldValue(webhookData.data.custom_fields, "address") == null) {
    return NextResponse.json({ error: "Address is not available" }, { status: 400 })
  }

  const {postal_code, formatted_address} = getCustomFieldValue(webhookData.data.custom_fields, "address") as ADDRESS_FIELD  
  if (!postal_code || !formatted_address) {
    return NextResponse.json({ error: "Address is not available" }, { status: 400 })
  }

  const postcodeRequest = await fetch(`https://api.homedata.co.uk/address/postcode/${postal_code}/`, {
    headers: {
      ["Authorization"]: `Api-Key ${process.env.HOMEDATA_API_KEY}`,
    },
  })

  const housesAvailable: {
    postcode?: string,
    count?: number,
    addresses: {uprn?: number, building_name?: string, building_number?: string}[]
  } = await postcodeRequest.json()

  if (!housesAvailable.count || housesAvailable.count == 0) {
    console.log("Address not found", housesAvailable)
    return NextResponse.json({ error: "Address not found" }, { status: 400 })
  }

  // formatted_address = '5 Ecclesfield Rd, Sheffield S9 1NW, UK'
  // Returned to us:
  // '5 ECCLESFIELD ROAD, SHIREGREEN, SHEFFIELD, S9 1NW'
  // value.building_number = 5

  // formatted_address = 'SCHOLES LODGE, SCHOLES VILLAGE, SCHOLES, ROTHERHAM, S61 2RQ'
  // Returned to us:
  // 'Scholes Lodge, Scholes Lane, Scholes, Rotherham, UK'
  // value.building_name = "Scholes Lodge"

  const building = housesAvailable.addresses.find((value) => {
    if (value.building_name && value.building_name.length > 0 && formatted_address.split(",")[0].trim().toLowerCase() == value.building_name.trim().toLowerCase()) {
      return true
    }

    if (value.building_number && value.building_number.length > 0 && formatted_address.split(" ")[0].trim() == value.building_number.trim()) { 
      return true
    }

    return false
  })

  if (!building?.uprn) {
    return NextResponse.json({ error: "Address not found" }, { status: 400 })
  }

  let payload: Record<string, any> = {}

  if (getCustomFieldValue(webhookData.data.custom_fields, "property value") == null) {
    const valuationRequest = await fetch(`https://api.homedata.co.uk/valuations/estimate/?uprn=${building.uprn}&type=sale`, {
      headers: {
        ["Authorization"]: `Api-Key ${process.env.HOMEDATA_API_KEY}`,
      },
    })

    const {range_low_gbp, range_high_gbp}: {range_low_gbp: number, range_high_gbp: number} = await valuationRequest.json()
    payload[NICE_FIELDS["property value"]] = `${range_low_gbp} - ${range_high_gbp}`
  }

  if (getCustomFieldValue(webhookData.data.custom_fields, "bedroom count") == null || getCustomFieldValue(webhookData.data.custom_fields, "build year") == null) {
    const valuationRequest = await fetch(`https://api.homedata.co.uk/properties/${building.uprn}`, {
      headers: {
        ["Authorization"]: `Api-Key ${process.env.HOMEDATA_API_KEY}`,
      },
    })

    const {construction_age_band, bedrooms}: {construction_age_band: string, bedrooms: number} = await valuationRequest.json()
    if (getCustomFieldValue(webhookData.data.custom_fields, "build year") == null) {
      payload[NICE_FIELDS["build year"]] = construction_age_band ? String(construction_age_band) : undefined
    }

    if (getCustomFieldValue(webhookData.data.custom_fields, "bedroom count") == null) {
      payload[NICE_FIELDS["bedroom count"]] = bedrooms ? Number(bedrooms) : undefined
    }
  }

  console.log(payload)

  const response = await fetch(`https://${webhookData.meta.host}/api/v2/deals/${webhookData.data.id}`, {
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
  } else {
    console.error("Failed to update deal:", result);
  }

  return NextResponse.json({}, {status: 200});
}