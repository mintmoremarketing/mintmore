/**
 * Live updates to the browser over Server-Sent Events. Channels: one per job id, plus 'system'
 * (studio setup and the computer check).
 */
const clients = new Map(); // channel -> Set<res>
const recent = new Map(); // channel -> last N log lines, so a page opened mid-run catches up

export function subscribe(channel, req, res) {
  res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive'});
  res.write(': connected\n\n');
  for (const ev of recent.get(channel) ?? []) res.write(`data: ${JSON.stringify(ev)}\n\n`);
  if (!clients.has(channel)) clients.set(channel, new Set());
  clients.get(channel).add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => {
    clearInterval(ping);
    clients.get(channel)?.delete(res);
  });
}

export function publish(channel, event) {
  const ev = {t: Date.now(), ...event};
  if (ev.type === 'log') {
    const list = recent.get(channel) ?? [];
    list.push(ev);
    if (list.length > 300) list.shift();
    recent.set(channel, list);
  }
  for (const res of clients.get(channel) ?? []) res.write(`data: ${JSON.stringify(ev)}\n\n`);
}

export const clearLog = (channel) => recent.delete(channel);
