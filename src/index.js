/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { LogStore } from './log_store';

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		if (url.pathname.startsWith('/api')) {
			const id = env.LOG_STORE.idFromName('default');
			const obj = env.LOG_STORE.get(id);
			return obj.fetch(request);
		}

		return new Response(
			`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<title>Log Viewer</title>
				<style>
				body {
					margin: 0;
					font-family: sans-serif;
					display: flex;
					height: 100vh;
					overflow: hidden;
				}
				#left {
					width: 30%;
					border-right: 1px solid #ccc;
					padding: 10px;
					overflow: hidden;
				}
				#right {
					flex: 1;
					display: flex;
					flex-direction: column;
					padding: 10px;
					overflow: hidden;
				}
				
				#log-list {
					height: 100%;
					overflow-y: auto;
					display: flex;
					flex-direction: column;
					gap: 0px;
				}

				#details-scroll {
					flex: 1;
					overflow-y: auto;
					display: flex;
					flex-direction: column;
					gap: 0px;
				}

				#headers, #body {
					flex: none;
				}

				.log-item {
					padding: 5px;
					border-bottom: 1px solid #eee;
					cursor: pointer;
					position: relative;
				}
				.log-item:hover .delete-btn {
					display: block;
				}
				.delete-btn {
					position: absolute;
					right: 5px;
					top: 5px;
					display: none;
					cursor: pointer;
					color: red;
				}
				pre {
					background: #f0f0f0;
					padding: 10px;
					overflow: auto;
				}
				table {
					border-collapse: collapse;
					width: 100%;
				}
				th,
				td {
					border: 1px solid #ccc;
					padding: 5px;
					text-align: left;
				}
				.method-tag {
					display: inline-block;
					background-color: #e53935; /* Đỏ */
					color: white;
					padding: 2px 6px;
					border-radius: 4px;
					font-size: 12px;
					margin-right: 6px;
					text-transform: uppercase;
				}
				</style>
			</head>
			<body>
				<div id="left">
				<div
					id="refresh-control"
					style="padding: 5px; border-bottom: 1px solid #ccc"
				>
					<label style="font-size: 14px">
					<input type="checkbox" id="autoRefreshToggle" />
					🔄 Auto Refresh - URL: <a href="https://events.hiennv.com/api/logs" target="_blank">https://events.hiennv.com/api/logs</a>
					</label>
				</div>
				<div id="log-list"></div>
				</div>
				<div id="right">
					<div id="info">
					</div>
					<div id="details-scroll">
						<div id="headers">
							<h3>Headers</h3>
							<table></table>
						</div>
						<div id="query">
							<h3>Query</h3>
							<pre></pre>
						</div>
						<div id="body">
							<h3>Body</h3>
							<pre></pre>
						</div>
					</div>
				</div>

				<script>
				function getMethodColor(method) {
					switch (method) {
					case "GET":
						return "#43a047";
					case "POST":
						return "#e53935";
					case "PUT":
						return "#fb8c00";
					case "DELETE":
						return "#6d4c41";
					default:
						return "#757575";
					}
				}

				let logs = [];
				let latestId = null;

				async function loadLogs() {
					const res = await fetch("/api");
					const newLogs = await res.json();
					if (!latestId || (newLogs.length && newLogs[0].id !== latestId)) {
					logs = newLogs;
					latestId = logs.length > 0 ? logs[0].id : null;

					const listContainer = document.getElementById("log-list");
					listContainer.innerHTML = "";
					logs.forEach((log) => {
						const div = document.createElement("div");
						div.className = "log-item";
						const methodColor = getMethodColor(log.method);
						div.innerHTML =
						'<span class="method-tag" style="background:' +
						methodColor +
						'">' +
						log.method +
						"</span>" +
						new Date(log.time).toLocaleString() +
						'<span class="delete-btn">❌</span>';
						div.onclick = () => showDetail(log.time);
						div.querySelector(".delete-btn").onclick = (e) => {
						e.stopPropagation();
						deleteLog(log.time);
						};
						listContainer.appendChild(div);
					});
					if (logs.length > 0) {
						showDetail(logs[0].time);
					} else {
					 	document.querySelector("#info").innerHTML = "";
						document.querySelector("#query pre").textContent = "";
						document.querySelector("#headers table").innerHTML = "";
						document.querySelector("#body pre").textContent =
						"No logs available";
					}
					}
				}

				function showDetail(time) {
					const log = logs.find((l) => l.time === time);
					if (!log) return;
					document.querySelector("#info").innerHTML = "<p><strong>Time:</strong> " + new Date(log.time).toLocaleString() + "</p>";
					document.querySelector("#info").innerHTML +=
					"<p><strong>Method:</strong> <span class='method-tag' style='background:" +
					getMethodColor(log.method) +
					"'>" +
					log.method +
					"</span></p>";
					document.querySelector("#info").innerHTML +=
					"<p><strong>URL:</strong> <a href='" +
					log.url +
					"' target='_blank'>" +
					log.url +
					"</a></p>";

					const table = document.querySelector("#headers table");
					table.innerHTML = "";
					for (let [k, v] of Object.entries(log.headers)) {
					const row = document.createElement("tr");
					row.innerHTML = "<td>" + k + "</td><td>" + v + "</td>";
					table.appendChild(row);
					}
					const url = new URL(log.url);
					const params = Object.fromEntries(url.searchParams.entries())
					document.querySelector("#query pre").textContent = JSON.stringify(params, null, 2);
					document.querySelector("#body pre").textContent = JSON.stringify(
					log.data,
					null,
					2
					);
				}

				async function deleteLog(time) {
					await fetch("/api?time=" + encodeURIComponent(time), {
					method: "DELETE",
					});
					await loadLogs();
				}

				document
					.getElementById("autoRefreshToggle")
					.addEventListener("change", function () {
					if (this.checked) {
						autoRefreshInterval = setInterval(loadLogs, 5000);
					} else {
						clearInterval(autoRefreshInterval);
						autoRefreshInterval = null;
					}
					});

				loadLogs();
				</script>
			</body>
			</html>
      `,
			{
				headers: { 'Content-Type': 'text/html; charset=utf-8' },
			}
		);
	},
};

export { LogStore };
