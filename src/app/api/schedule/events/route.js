import events from '@/lib/events';

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (data) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      const onChange = (payload) => send({ type: 'schedule-changed', payload });
      // Initial ping
      send({ type: 'connected', ts: Date.now() });
      events.on('schedule-changed', onChange);
      const interval = setInterval(() => send({ type: 'ping', ts: Date.now() }), 25000);
      controller.signal.addEventListener('abort', () => {
        clearInterval(interval);
        events.off('schedule-changed', onChange);
      });
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
