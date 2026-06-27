type AttioObject = {
  api_slug?: string;
  singular_noun?: string;
  id?: {
    object_id?: string;
  };
};

type AttioObjectsResponse = {
  data?: AttioObject[];
  error?: {
    message?: string;
  };
};

export async function GET() {
  const apiKey = process.env.ATTIO_API_KEY;
  const workspaceId = process.env.ATTIO_WORKSPACE_ID;

  if (!apiKey || !workspaceId) {
    return Response.json({
      mode: "mock",
      source: "Missing Attio key or workspace ID",
      objects: [],
    });
  }

  try {
    const response = await fetch("https://api.attio.com/v2/objects", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return Response.json({
        mode: "mock",
        source: `Attio validation failed (${response.status})`,
        objects: [],
      });
    }

    const data = (await response.json()) as AttioObjectsResponse;
    const objects = (data.data ?? [])
      .map(
        (object) =>
          object.api_slug ?? object.singular_noun ?? object.id?.object_id,
      )
      .filter((object): object is string => Boolean(object));

    return Response.json({
      mode: "live",
      source: `${objects.length} Attio objects available`,
      objects,
    });
  } catch {
    return Response.json({
      mode: "mock",
      source: "Attio validation request failed",
      objects: [],
    });
  }
}
