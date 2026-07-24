"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const child_process_1 = require("child_process");
const sqlite3_1 = require("sqlite3");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const THINGS_DB_PATH = path_1.default.join(os_1.default.homedir(), "Library/Group Containers/JLMPQHK86H.com.culturedcode.ThingsMac", "Things Database.thingsdatabase/main.sqlite");
const BEAR_DB_PATH = path_1.default.join(os_1.default.homedir(), "Library/Group Containers/9K33E3U3T4.net.shinyfrog.bear", "Application Data/database.sqlite");
function queryDb(dbPath, sql, params = []) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3_1.Database(dbPath, sqlite3_1.OPEN_READONLY, (err) => {
            if (err)
                return reject(err);
        });
        db.all(sql, params, (err, rows) => {
            db.close();
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    });
}
function openUrl(url) {
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(`open ${JSON.stringify(url)}`, (error) => {
            if (error)
                reject(error);
            else
                resolve();
        });
    });
}
const server = new mcp_js_1.McpServer({
    name: "things-bear-mcp",
    version: "0.1.0",
});
// --- Things 3 Tools ---
server.tool("things_get_tasks", "Get tasks from Things 3. Optionally filter by project or area.", {
    project: zod_1.z.string().optional().describe("Filter by project title"),
    area: zod_1.z.string().optional().describe("Filter by area title"),
    status: zod_1.z.enum(["incomplete", "completed", "canceled"]).optional().describe("Task status filter (default: incomplete)"),
    limit: zod_1.z.number().optional().describe("Max number of tasks to return (default: 50)"),
}, async ({ project, area, status, limit }) => {
    const conditions = ["TMTask.type = 0"];
    const params = [];
    const statusMap = { incomplete: 0, completed: 3, canceled: 2 };
    const statusVal = statusMap[status ?? "incomplete"];
    conditions.push("TMTask.status = ?");
    params.push(statusVal);
    if (project) {
        conditions.push("TMTask.project IN (SELECT uuid FROM TMTask WHERE type = 1 AND title = ?)");
        params.push(project);
    }
    if (area) {
        conditions.push("TMTask.area IN (SELECT uuid FROM TMArea WHERE title = ?)");
        params.push(area);
    }
    const sql = `
      SELECT TMTask.uuid, TMTask.title, TMTask.notes,
             TMTask.dueDate, TMTask.startDate,
             (SELECT title FROM TMTask AS p WHERE p.uuid = TMTask.project) AS projectTitle,
             (SELECT title FROM TMArea WHERE uuid = TMTask.area) AS areaTitle
      FROM TMTask
      WHERE ${conditions.join(" AND ")}
      ORDER BY TMTask."index"
      LIMIT ?
    `;
    params.push(limit ?? 50);
    try {
        const rows = await queryDb(THINGS_DB_PATH, sql, params);
        return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error reading Things database: ${e}` }], isError: true };
    }
});
server.tool("things_get_projects", "List projects from Things 3.", {
    includeCompleted: zod_1.z.boolean().optional().describe("Include completed projects (default: false)"),
}, async ({ includeCompleted }) => {
    const statusFilter = includeCompleted ? "" : "AND status = 0";
    const sql = `
      SELECT uuid, title, notes, status,
             (SELECT title FROM TMArea WHERE uuid = TMTask.area) AS areaTitle
      FROM TMTask
      WHERE type = 1 ${statusFilter}
      ORDER BY "index"
    `;
    try {
        const rows = await queryDb(THINGS_DB_PATH, sql);
        return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error reading Things database: ${e}` }], isError: true };
    }
});
server.tool("things_get_areas", "List areas from Things 3.", {}, async () => {
    const sql = `SELECT uuid, title FROM TMArea ORDER BY "index"`;
    try {
        const rows = await queryDb(THINGS_DB_PATH, sql);
        return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error reading Things database: ${e}` }], isError: true };
    }
});
server.tool("things_add_task", "Create a new task in Things 3 using the Things URL scheme.", {
    title: zod_1.z.string().describe("Task title"),
    notes: zod_1.z.string().optional().describe("Task notes"),
    when: zod_1.z.string().optional().describe("When to schedule: 'today', 'tomorrow', 'evening', or a date string"),
    deadline: zod_1.z.string().optional().describe("Deadline date string"),
    list: zod_1.z.string().optional().describe("Project or area name to add the task to"),
    tags: zod_1.z.array(zod_1.z.string()).optional().describe("Tags to apply"),
    checklist: zod_1.z.array(zod_1.z.string()).optional().describe("Checklist items"),
}, async ({ title, notes, when, deadline, list, tags, checklist }) => {
    const params = new URLSearchParams();
    params.set("title", title);
    if (notes)
        params.set("notes", notes);
    if (when)
        params.set("when", when);
    if (deadline)
        params.set("deadline", deadline);
    if (list)
        params.set("list", list);
    if (tags)
        params.set("tags", tags.join(","));
    if (checklist)
        params.set("checklist-items", checklist.map((i) => `- ${i}`).join("\n"));
    const url = `things:///add?${params.toString()}`;
    try {
        await openUrl(url);
        return { content: [{ type: "text", text: `Task "${title}" created in Things 3.` }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error creating task: ${e}` }], isError: true };
    }
});
// --- Bear Tools ---
server.tool("bear_get_notes", "Search and list notes from Bear. Returns title and truncated text.", {
    search: zod_1.z.string().optional().describe("Search term to filter notes by title or content"),
    tag: zod_1.z.string().optional().describe("Filter by tag"),
    limit: zod_1.z.number().optional().describe("Max number of notes to return (default: 50)"),
}, async ({ search, tag, limit }) => {
    const conditions = ["ZTRASHED = 0"];
    const params = [];
    if (search) {
        conditions.push("(ZTITLE LIKE ? OR ZTEXT LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
    }
    if (tag) {
        conditions.push(`ZUNIQUEIDENTIFIER IN (
        SELECT DISTINCT Z_7NOTES FROM Z_7TAGS
        JOIN ZSFNOTETAG ON Z_7TAGS.Z_14TAGS = ZSFNOTETAG.Z_PK
        WHERE ZSFNOTETAG.ZTITLE = ?
      )`);
        params.push(tag);
    }
    const sql = `
      SELECT ZUNIQUEIDENTIFIER AS id, ZTITLE AS title,
             substr(ZTEXT, 1, 500) AS text,
             datetime(ZCREATIONDATE + 978307200, 'unixepoch') AS created,
             datetime(ZMODIFICATIONDATE + 978307200, 'unixepoch') AS modified
      FROM ZSFNOTE
      WHERE ${conditions.join(" AND ")}
      ORDER BY ZMODIFICATIONDATE DESC
      LIMIT ?
    `;
    params.push(limit ?? 50);
    try {
        const rows = await queryDb(BEAR_DB_PATH, sql, params);
        return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error reading Bear database: ${e}` }], isError: true };
    }
});
server.tool("bear_get_note", "Get a full note from Bear by its ID.", {
    id: zod_1.z.string().describe("Bear note unique identifier"),
}, async ({ id }) => {
    const sql = `
      SELECT ZUNIQUEIDENTIFIER AS id, ZTITLE AS title, ZTEXT AS text,
             datetime(ZCREATIONDATE + 978307200, 'unixepoch') AS created,
             datetime(ZMODIFICATIONDATE + 978307200, 'unixepoch') AS modified
      FROM ZSFNOTE
      WHERE ZUNIQUEIDENTIFIER = ? AND ZTRASHED = 0
    `;
    try {
        const rows = await queryDb(BEAR_DB_PATH, sql, [id]);
        if (rows.length === 0) {
            return { content: [{ type: "text", text: "Note not found." }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(rows[0], null, 2) }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error reading Bear database: ${e}` }], isError: true };
    }
});
server.tool("bear_get_tags", "List all tags from Bear.", {}, async () => {
    const sql = `SELECT ZTITLE AS title FROM ZSFNOTETAG ORDER BY ZTITLE`;
    try {
        const rows = await queryDb(BEAR_DB_PATH, sql);
        return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error reading Bear database: ${e}` }], isError: true };
    }
});
server.tool("bear_create_note", "Create a new note in Bear using the Bear URL scheme.", {
    title: zod_1.z.string().describe("Note title"),
    text: zod_1.z.string().optional().describe("Note body (supports Markdown)"),
    tags: zod_1.z.array(zod_1.z.string()).optional().describe("Tags to apply"),
}, async ({ title, text, tags }) => {
    const params = new URLSearchParams();
    params.set("title", title);
    if (text)
        params.set("text", text);
    if (tags)
        params.set("tags", tags.join(","));
    const url = `bear://x-callback-url/create?${params.toString()}`;
    try {
        await openUrl(url);
        return { content: [{ type: "text", text: `Note "${title}" created in Bear.` }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error creating note: ${e}` }], isError: true };
    }
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
