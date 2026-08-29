import redisConnection from "@/lib/redis"

export async function getDataFromAddress(addressString: string) {  
	console.log("uprn from address", addressString)
	addressString = addressString.trim().toLowerCase()

	try {
		const cachedData = await redisConnection.get(addressString)
		if (cachedData) {
			return JSON.parse(cachedData)
		}
	} catch (err) {
		console.warn("Redis get error:", err)
	}

  const addressFields = [
		"id",
    "property.attributes.status.date_of_construction_declared_and_predicted",
    "property.attributes.indoor.bedrooms_declared_and_predicted"
  ].join(",");

	const response = await fetch(`https://api.chimnie.com/residential/address/${encodeURIComponent(addressString)}?fields=${encodeURIComponent(addressFields)}`, {
		method: "GET",
		headers: {
			"Authorization": `Bearer ${process.env.CHIMNIE_API_KEY}`,
			"Content-Type": "application/json"
		}
	});

	const data = await response.json();

	if (!response.ok) {
		console.error("API Error (address):", data);
		return;
	}

	const uprn = data?.id;
	if (!uprn) { 
		console.error("no uprn found")
		return
	}

	const valuationFields = "property.value.sale.property_value_range";
	const valuationResponse = await fetch(`https://api.chimnie.com/residential/uprn/${encodeURIComponent(uprn)}?fields=${encodeURIComponent(valuationFields)}`, {
		method: "GET",
		headers: {
			"Authorization": `Bearer ${process.env.CHIMNIE_API_KEY}`,
			"Content-Type": "application/json"
		}
	});

	if (valuationResponse.ok) {
		const valuationData = await valuationResponse.json();
		if (valuationData?.property?.value) {
			if (!data.property) {
				data.property = {};
			}
			data.property.value = valuationData.property.value;
		}
	} else {
		console.error("API Error (valuation via UPRN):", await valuationResponse.json().catch(() => null));
	}

	try {
		await redisConnection.set(addressString, JSON.stringify(data), {
			EX: 60 * 60 * 24
		});
	} catch (err) {
		console.warn("Redis set error:", err)
	}

	return data;
}