export class LogStore {
	constructor(state, env) {
		this.state = state;
		this.env = env;
	}


	async fetch(request) {
		const url = new URL(request.url);

		if (url.pathname.startsWith('/api/logs')) {

            async function safeReadJson(request) {
                const contentType = request.headers.get("content-type") || "";
                if (
                    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) &&
                    contentType.includes("application/json")
                ) {
                    try {
                        return await request.json();
                    } catch (e) {
                    console.warn("Invalid JSON body", e);
                        return null;
                    }
                }
                return null;
            }

			try {
				const body = await safeReadJson(request);
				const headers = Object.fromEntries(request.headers.entries());

				let logs = (await this.state.storage.get('logs')) || [];

				logs.unshift({
					time: new Date().toISOString(),
                    method: request.method,
                    url: url.href,
					headers,
					data: body,
				});

				logs = logs.slice(0, 50);
				await this.state.storage.put('logs', logs);

				return new Response(JSON.stringify({ message: 'Saved', total: logs.length }), {
					headers: { 'Content-Type': 'application/json' },
				});
			} catch (error) {
				return new Response(
					JSON.stringify({
						error: error.message || 'Failed to save',
					}),
					{
						status: 400,
						headers: {
							'Content-Type': 'application/json',
						},
					}
				);
			}
		}

		if (request.method === 'GET') {
			const logs = (await this.state.storage.get('logs')) || [];
            const sorted = logs.sort((a, b) => new Date(b.time) - new Date(a.time));
			return new Response(JSON.stringify(sorted), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

        if (request.method === 'DELETE') {
            const time = url.searchParams.get('time');
            if (!time) {
                return new Response('Time parameter is required', { status: 400 });
            }
            let logs = (await this.state.storage.get('logs')) || [];
            logs = logs.filter(log => log.time !== time);
            await this.state.storage.put('logs', logs);
            return new Response(JSON.stringify({ message: 'Deleted', total: logs.length }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

		return new Response('Method not allowed', { status: 405 });
	}
}
