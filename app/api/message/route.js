let latestMessage = "";

export async function POST(req) {
  const body = await req.json();

  latestMessage = body.text;

  return Response.json({
    success: true,
  });
}

export async function GET() {
  return Response.json({
    message: latestMessage,
  });
}