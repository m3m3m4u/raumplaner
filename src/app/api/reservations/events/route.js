import events from '@/lib/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (data) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (_) {}
      };
      const onChange = (payload) => send({ type: 'reservations-changed', payload });

      send({ type: 'connected', ts: Date.now() });
      events.on('reservations-changed', onChange);
      const interval = setInterval(() => send({ type: 'ping', ts: Date.now() }), 25000);

      const cleanup = () => {
        clearInterval(interval);
        events.off('reservations-changed', onChange);
      };

      if (request?.signal) {
        request.signal.addEventListener('abort', cleanup);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    }
  });
}