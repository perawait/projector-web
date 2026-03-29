import { getFilteredMessages, getMessageStatuses, subscribeToMessages } from "../store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function matchesStatuses(message, statuses) {
  return !statuses?.length || statuses.includes(message.status);
}

export async function GET(req) {
  const encoder = new TextEncoder();
  const filters = getRequestFilters(req);

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event, payload) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
        );
      };

      sendEvent("snapshot", {
        messages: getFilteredMessages(filters),
      });

      const unsubscribe = subscribeToMessages((event) => {
        if (!matchesStatuses(event.message, filters.statuses)) {
          return;
        }

        sendEvent("message", {
          type: event.type,
          message: event.message,
        });
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 15000);

      const closeStream = () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      };

      req.signal.addEventListener("abort", closeStream, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}