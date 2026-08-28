import { NextRequest, NextResponse } from "next/server";

enum NICE_FIELDS {
  "build year" = "6b0ad1072fafea88abac47f255c928694bd89396",
  "bedroom count" = "2384df7ed37673d41cc1b07d4b15e468f31b40a7",
  "address" = "ec6975e3106a4cbf110c116651da7eba2017f404",
  "property value" = "ea18ed95ddd4de2a5e9692d853a5d44aab403fe6",
}

type CUSTOM_FIELDS = {
  [K in NICE_FIELDS]: string;
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

  const {data: {custom_fields}, meta}: {data: {custom_fields: CUSTOM_FIELDS}, meta: any} = await req.json()

  if (getCustomFieldValue(custom_fields, "address") == null) {
    return NextResponse.json({ error: "Address is not available" }, { status: 400 })
  }

  console.log(getCustomFieldValue(custom_fields, "bedroom count"))
  console.log(getCustomFieldValue(custom_fields, "build year"))
  console.log(getCustomFieldValue(custom_fields, "property value"))

  //process.env.HOMEDATA_API_KEY
  
  return NextResponse.json({}, {status: 200});
}