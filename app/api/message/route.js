import {
  createMessage,
  getFilteredMessages,
  getMessageStatuses,
  getSenderKey,
  updateMessageStatus,
} from "./store";

function getRequestFilters(req) {
  const url = new URL(req.url);
  const requestedStatuses = url.searchParams
    .get("status")
    ?.split(",")
    .map((status) => status.trim())
    .filter((status) => getMessageStatuses().has(status));
  const limitParam = Number(url.searchParams.get("limit"));

  return {
    statuses: requestedStatuses,
    limit: Number.isFinite(limitParam) ? limitParam : undefined,
  };
}

export async function POST(req) {
  const body = await req.json();
  const result = createMessage({
    text: body.text,
    senderKey: getSenderKey(req),
  });

  if (!result.success) {
    return Response.json({ success: false, error: result.error }, { status: result.status });
  }

  return Response.json({ success: true, message: result.message }, { status: result.status });
}

export async function GET(req) {
  const filters = getRequestFilters(req);

  return Response.json({
    success: true,
    messages: getFilteredMessages(filters),
  });
}

export async function PATCH(req) {
  const body = await req.json();
  const result = updateMessageStatus({
    id: String(body.id ?? "").trim(),
    status: String(body.status ?? "").trim(),
  });

  if (!result.success) {
    return Response.json({ success: false, error: result.error }, { status: result.status });
  }

  return Response.json({ success: true, message: result.message }, { status: result.status });
}