# Case Management Whole-Life Wiki

Last updated: 2026-05-03

This is the living product and engineering spec for the Case Management Wiki. Read this file before changing Case Management knowledge, ingestion, graph, archive, or retrieval features.

## North Star

Build a Case Management knowledge layer that can ingest source material from the application and from the user's computer, organize it into a readable wiki, preserve source provenance, write relationships into Neo4j, and prepare reviewed chunks for Weaviate semantic search.

The end state is not "upload files and search them." The end state is:

- A working wiki that captures a person's life, projects, cases, services, documents, notes, and relationships over time.
- A source archive where files enter as standalone source documents first.
- A human review desk where the user confirms what should be attached, embedded, linked, or ignored.
- A graph view that shows how sources, people, cases, services, projects, timelines, and topics connect.
- A vector layer that supports semantic retrieval after the user can see and approve what is being embedded.
- A case-management UI that keeps this inside Case Management, without disrupting the rest of Street Voices.

This is both a Case Management feature and a general-purpose life-wiki engine. Case Management is the first home for it because case work needs source review, graph reasoning, timelines, and privacy controls. The archive itself must be able to organize everything on the user's computer: personal admin, creative work, Street Voices operations, client/case material, systems innovation documents, partner lists, research, screenshots, exports, notes, spreadsheets, emails, calendars, media, and future connector data.

The system must not force general life material into client/case records. It needs a domain layer that keeps personal, project, creative, operational, and case-management knowledge separate until the user explicitly links them.

## Design Principles

1. Source first, attachment second.
   Every uploaded or discovered file becomes a standalone source page before it is linked to a client, case, service, project, or Street Profile. The app can suggest links, but it must not silently attach personal documents to people.

2. Review before embedding.
   The user must be able to inspect the source page, extracted text, privacy level, redaction mode, proposed chunks, and graph nodes before data is sent into the semantic index.

3. Neo4j is the relationship truth.
   Neo4j stores the explicit knowledge graph: sources, pages, people, cases, services, projects, topics, timeline events, source claims, review decisions, and attachment edges.

4. Weaviate is the semantic retrieval layer.
   Weaviate stores reviewed text chunks and metadata for vector, keyword, hybrid, and filtered search. It should not be the only place where relationships live.

5. Wiki pages are the human-readable memory.
   The wiki should look and behave like an encyclopedia: stable page titles, lead summaries, sections, citations, backlinks, related pages, source notes, talk/review context, and chronology.

6. Open-brain style means inspectable thinking.
   The system should expose how knowledge was formed: what source was read, what was extracted, what was inferred, what is confirmed, what is uncertain, and what still needs review.

7. Nothing destructive by default.
   File cleanup recommendations can be shown, but deletion, moving, renaming, or overwriting local files must be explicit and separately confirmed.

8. Keep Case Management scoped.
   This feature belongs inside the Case Management app. It can link to Street Profile, Directory, Calendar, Tasks, and Documents, but it should not redesign those apps unless a specific integration requires it.

9. Whole-life does not mean one bucket.
   The archive must support general-purpose organization outside case management: personal life, projects, research, creative assets, systems work, operations, finances/admin, correspondence, and case-management records all need distinct lanes, privacy controls, and graph labels.

10. Domain before destination.
   Every source should be classified into a domain and collection before any destination decision. Example domains: Personal, Street Voices, Case Management, Projects, Creative, Research, Admin, Services, Partners, and Unknown.

## Research Notes

These references shape the architecture:

- Karpathy-style LLM Wiki: keep knowledge in readable wiki form, grounded in source material, optimized for LLM retrieval and human correction. Reference: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- Weaviate hybrid search combines vector search and keyword/BM25 search, which fits a personal archive where exact names and fuzzy meaning both matter. Reference: https://docs.weaviate.io/weaviate/search/hybrid
- Weaviate supports collection/vector configuration and metadata-oriented retrieval patterns, which maps well to source chunks plus review metadata. Reference: https://docs.weaviate.io/weaviate/manage-collections/vector-config
- Neo4j models data as connected nodes and relationships, which fits explicit case-management knowledge better than a flat document store. Reference: https://neo4j.com/docs/getting-started/graph-database/
- Neo4j also has vector index features, but in this project Neo4j should remain the relationship system while Weaviate handles the dedicated vector database role. Reference: https://neo4j.com/docs/cypher-manual/current/indexes/semantic-indexes/vector-indexes/
- Open Brain inspiration: make knowledge organization transparent, personal, reflective, and inspectable instead of a black-box file dump. Reference: https://openbrainsystem.com/index

## Current State In Code

Current implementation pieces:

- Frontend: `client/src/components/streetbot/case-management/CaseManagementPage.tsx`
- Routes: `api/server/routes/caseManagement.js`
- Upload and graph builder: `api/server/services/CaseManagementWikiIngestion.js`
- Local archive scanner: `api/server/services/CaseManagementLocalArchive.js`
- Weaviate dry-run wrapper: `api/server/services/CaseManagementWeaviate.js`
- Graph browser/query wrapper: `api/server/services/CaseManagementWikiGraph.js`
- Local archive tests: `api/server/services/CaseManagementLocalArchive.spec.js`
- Weaviate dry-run tests: `api/server/services/CaseManagementWeaviate.spec.js`
- Graph browser tests: `api/server/services/CaseManagementWikiGraph.spec.js`
- Ingestion persistence: `api/models/CaseManagementWikiIngestion.js`
- Async ingest jobs: `api/models/CaseManagementWikiIngestJob.js`

Already working or partially working:

- Browser upload, drag/drop, pasted source text, and local archive scan entry points.
- Local archive scan across mounted Desktop, Documents, and Downloads paths.
- File type staging for CSV, TXT, MD, JSON, HTML, ICS, VCF, RTF, PDF, DOCX, PPTX, XLSX, images, and metadata-only binary records.
- Local archive organizer lanes: partner lists, projects/strategy, case-management material, personal admin/identity, correspondence, media, tables/datasets, and source documents.
- Guided import passes for each local scan: clean high-value sources, cleanup/canonical review, media transcript review, personal/admin privacy review, already-known source history, readable extraction, visual OCR review, and long-tail review.
- Cleanup signals for duplicates, copies, screenshots, old files, download/export files, large files, and credential-like files.
- Credential-like file quarantine from normal wiki ingestion.
- Standalone source document ingestion with strict redaction defaults for local archive imports.
- Neo4j graph writes for source files, wiki pages, archive collections, lanes, topics, semantic-index placeholders, mentions, and reviewed attachment edges.
- Archive review queue with search, filters, suggested matches, keep-standalone, flag-for-attachment, attach-to-record, and reopen-review actions.
- Batch review desk for selecting visible/unreviewed source records and updating safe review states in batches.
- Wiki pages that show source notebook metadata, archive decision, extracted lead, entities, sections, related source documents, client longitudinal context, and chronology.
- Life Domains are first-class wiki index pages. They group standalone sources by domain, show review/attachment counts, lanes, collections, source kinds, and recent source pages without treating general documents as client or case records.
- Life Domain pages now include a domain review desk and graph/embedding readiness rollup. Reviewers can filter the archive queue to a domain, select unreviewed domain sources, open the next source needing review, and inspect graph node/relationship summaries before embedding.
- Life Domain pages now include a lightweight domain graph map. Reviewers can filter sources by collection, topic, reviewed attachment, or embedding state, inspect repeated entity clusters across source pages, focus the relationship queue on one repeated person/service/project/topic/collection, see a node-link graph of sources and repeated entities, pan/zoom that graph, toggle relationship labels, inspect a selected node, then approve or reject pending graph edges across visible source pages. In narrow panes, the article and graph come before the wiki index so Codex-style split views stay usable.
- Graph relationship review now has a backend-backed human-decision ledger. Reviewers can approve or reject visible source relationships from Life Domain graph examples and source-page graph edges; those decisions persist on the source record, emit audit events, write review-decision nodes/edges into Neo4j, and appear as source-page graph diff cards with source-page filters for edge status, relationship type, and diff status. Source pages now also support batch approving or rejecting the pending graph edges that match the current filters, and Life Domain pages can batch-review pending relationships across multiple sources.
- Embedding review decisions now write a chunk provenance layer into Neo4j. Each reviewed source can create an `EmbeddingReview` node, `EmbeddingChunk` nodes, a `VectorIndex` node, and `READY_FOR_INDEX`, `EXCLUDED_FROM_INDEX`, or `INDEXED_IN` relationships so reviewed chunk state is queryable in the graph before and after Weaviate writes.

Known gaps:

- Weaviate live write path now exists but remains locked behind two gates: server environment write enablement and explicit UI confirmation after approved chunks are visible. Approved chunks still produce a dry-run object preview first; live writes are refused unless `CASE_MANAGEMENT_VECTOR_WRITE_ENABLED=true` and `CASE_MANAGEMENT_WEAVIATE_DRY_RUN=false`.
- Weaviate writes now carry a deterministic object ledger: source ID, chunk ID, Weaviate object ID, text hash, property hash, and object fingerprint. A confirmed delete route can remove exactly those stored object IDs and return the source to dry-run review state; deletes are refused unless the caller explicitly confirms and the same server write gates are enabled.
- Embedding review UI now supports full-source chunk search, status filters, filtered batch approval/exclusion/reset, single-chunk approval/exclusion/reset, reviewer text edits, privacy/redaction edits, and a dry-run preview. Editing a chunk resets that chunk to pending review so stale approvals cannot be sent to Weaviate.
- Graph visualization has an initial source-page browser and human relationship review controls. It can query Neo4j neighbors for the selected source and falls back to the saved source graph. Approved/rejected relationship decisions now write a review layer to Neo4j, show a before/after graph diff on source pages, can be filtered by edge status, relationship type, or decision status, can be batch-reviewed for pending filtered source edges, can be reviewed across source pages from Life Domain pages, and now groups repeated entities on Life Domain pages so reviewers can focus a domain-level relationship queue. Life Domain pages now also have a source-to-entity node-link graph slice with native zoom, scroll pan, relationship labels, resilient node inspection, URL-backed node selection, selected-node source graph expansion, layout/depth controls for larger imports, grouped import shelves for collection/domain-scale scans, a force-map layout for denser whole-life imports, drag-to-pin spatial editing for force maps, responsive collapse behavior for narrow app panes, graph search across sources/entities/relationships, graph presets for overview, whole-life import, review queue, and embedding-ready views, plus server-synced saved graph workspaces that preserve pinned graph positions for recurring archive-review angles while retaining localStorage fallback. Saved graph workspaces now carry owner, teammate visibility, share, duplicate, viewer/editor/manager role enforcement, per-workspace Neo4j sync status, backend-created `GraphWorkspace`/audit nodes inside the Case Wiki knowledge graph, a Neo4j workspace-history browser that reads saved graph workspaces back into the UI, restorable per-audit snapshot JSON/hash/version metadata, side-by-side current-vs-snapshot previews, rendered graph-slice metadata, interactive graph-slice diff targets, a restore preview drawer, manager-facing audit narratives, and manager review decisions with notes that sync into Neo4j as `GraphWorkspaceReview` nodes linked to the workspace and audit version. Those Neo4j review decisions now appear in workspace-history cards and can filter the active version trail by pending, approved, revision-requested, or rejected provenance. Cluster drill-down links load Neo4j-backed source graph browsers with saved graph fallback. The graph search box now also calls a server-backed graph search endpoint so large imports can search source metadata, extracted text, archive review fields, graph nodes, graph edges, relationship decisions, graph workspace review decisions, and embedding review state beyond the currently rendered slice.
- Local archive scans now have an initial named campaign state that survives reloads with the latest scan, selected candidates, roots, domains, import count, review count, cleanup count, campaign history, resume controls, review queue handoff, parser/OCR readiness, saved campaign checkpoints, an import lane board, a campaign lane command center, a backend-saved campaign schedule preview, a run-next-step coordinator, a backend-owned campaign runner endpoint, guarded cadence automation, visible background-ingest job controls, and a recent campaign job ledger. The command center can start focused whole-life, Street Voices operations, case-management evidence, research/web, media/transcript, and personal archive lanes while autosaving the previous active lane.
- Wiki index search now reaches beyond page titles into client/case records, first-class document pages, source text, parser notes, archive lanes, life domains, collections, review state, picky import selection decisions, Neo4j graph nodes/edges, and embedding review metadata. Search results show which parts of the record matched. Standalone source documents now stay in the Source documents lane without inheriting client/case context unless they are scoped to the current record or explicitly attached through archive review. The wiki index now also has a document library filter panel for file type, source/attachment boundary, cleanup review, duplicate, canonical, superseded, excluded, clean document states, and selection decisions such as `import-now`, `review-first`, `cleanup-first`, recovered legacy picks, and not-recorded sources, with saved document views, dedicated selection lanes for Import now, Review first, Cleanup first, and Recovered picks, open-next lane navigation, sort modes, and safe bulk actions for selecting, keeping standalone, or flagging unreviewed standalone sources.
- Source pages now include a decision trail that surfaces source-specific audit events, archive review status, reviewed-by/reviewed-at metadata, attachment target, embedding review state, and vector-write state. Archive review actions now persist source-level audit records alongside embedding-review audit records.
- Source pages now also include a source receipt ledger. It turns source capture, boundary review, Life Domain moves, picky import selection, cleanup decisions, embedding review, Weaviate dry-runs, Neo4j sync, vector writes, and relationship reviews into readable receipts with explicit yes/no markers for graph writes, vector writes, attachments, and file actions.
- Life Domain pages now roll source receipts into a domain receipt dashboard. Each shelf summarizes source count, receipt count, review needs, Neo4j write receipts, Weaviate write receipts, attachments, file actions, pending/approved chunks, relationship reviews, and open-source receipt links so whole-life imports can be audited at the domain level before drilling into individual documents. The dashboard now also filters receipts by needs-review, Neo4j, Weaviate, attachment, and review-only/no-write states, with select-filtered, queue-filtered, and open-next receipt actions that turn the receipt ledger into a reviewer-owned operating queue without attaching, embedding, graph-writing, moving, or cleaning files automatically.
- Source receipt pages now have the same handoff path at single-document scale. A reviewer can select the current source receipt for archive review or create a one-source receipt review queue from the ledger while preserving the review-only boundary: no attachment, embedding, graph write, file move, or cleanup runs from that handoff.
- Source receipt pages can also launch a review-safe single-source wiki article workup directly from the receipt ledger. The action creates article plan, citation, draft-preview, and readiness metadata only, keeping human promotion, embeddings, graph writes, attachments, file moves, and cleanup as separate confirmed steps.
- The source receipt ledger now records the source-to-article trail itself: article plan, citation review packet, draft preview, and human-promotion readiness appear as receipts with explicit no-write provenance. Draft and promotion receipts stay visible as pending receipts when those steps are not ready yet, so reviewers can see when a file has become wiki-ready metadata without confusing that with publication, embedding, graph sync, attachment, or cleanup.
- Source receipt rows now carry next-safe-action controls. Each receipt can route the reviewer to the correct source notebook, boundary desk, Life Domain shelf, cleanup decision, embedding review, vector gate, Neo4j sync, graph diff, or article builder step, and article receipts can continue through citation packet, draft preview, or readiness metadata without hidden promotion, attachment, vector write, file movement, or cleanup.
- The source receipt ledger now has one primary best-next-move card. It reads the same source-to-wiki route state as the article blocker desk and chooses the next safest action across boundary review, extraction, chunk review, article planning, citation packet, draft preview, readiness, promotion gate, backlink verification, or source notebook review. The primary action is explicit and keeps risky writes, attachments, file operations, and promotion behind their separate gates.
- Source receipt pages now show an active receipt queue checkpoint when the source is opened from a reviewer queue. It shows queue position, pending/reviewed progress, the next queued source, a safe open-next handoff, and a short preview of the pending queue so whole-life archive review can keep moving source by source without attaching, embedding, promoting, moving, deleting, or cleaning anything automatically.
- Active review queues now include a queue route map. Pending sources are sorted by current blocker across boundary review, extraction, chunk review, memory gates, and organized-only states, with per-source chunk counts, receipt signals, Neo4j status, and an open-route action that only navigates to the right source review surface.
- Active review queues now also show a boundary decision plan for the selected source. The plan separates document identity, Life Domain shelf, attachment risk, memory readiness, and cleanup lineage so reviewers can keep general documents standalone, stage shelf receipts, choose explicit client/case/service attachments only when justified, and continue toward extraction or embedding without hidden file, vector, graph, cleanup, or attachment writes.
- Boundary review now has a source evidence packet. The packet gathers source identity, live-record match signals, Life Domain shelf clues, duplicate/canonical lineage, and evidence-readiness state into one proof stack before the reviewer chooses a boundary outcome. Packet actions only navigate to review surfaces and preserve the source-first rule.
- Boundary review now includes a decision briefing. It turns the evidence packet into a single recommended route, confidence label, blocker list, supporting signal list, and next safe action so operators can move a file toward wiki organization without accidentally merging documents into clients/cases or unlocking graph/vector/write gates too early.
- Boundary review now includes a receipt preview before the outcome buttons. It shows the boundary decision that would be recorded, the source record that stays preserved, attachment boundaries, next wiki route, and locked gates so the operator can see exactly what will and will not change before saving an archive-review receipt.
- Boundary review now includes an outcome matrix. Reviewers can compare keep-standalone, flag-for-attachment, attach-selected-target, and reopen-review outcomes with explicit changes, locked gates, and unlocked next steps before acting. The matrix keeps general source documents separate from client/case/service records unless a target is selected and still does not run Weaviate writes, Neo4j sync, promotion, cleanup, file movement, deletion, or attachment without the proper gate.
- Active review queues now include a boundary receipt rollup. The queue card groups pending sources into open boundary receipts, standalone-first candidates, attachment-caution items, after-boundary routes, and a no-write contract so reviewers can process a whole batch without attaching documents, publishing articles, writing vectors, syncing Neo4j, moving files, deleting files, or cleaning files by accident.
- Active review queues now include a per-source boundary receipt packet. The packet sorts pending files by receipt risk and next wiki gate, recommends keep-standalone, attachment caution, shelf, extraction, evidence review, or article/memory gate routes, and only opens the selected source without saving review decisions or running writes.
- Per-source boundary packets now include draft receipt text. Each queued source shows the proposed reviewer decision, supporting evidence, review question, and locked gates so human reviewers can understand the audit trail before saving a receipt or turning a file into durable wiki memory.
- Active review queues now include a queue draft receipt ledger. It counts the full pending queue by draft receipt lane, including standalone, attachment caution, Life Domain shelf, extraction, evidence review, article/memory gate, and organized-source receipts, then opens the first source in a lane without saving receipts or running graph, vector, attachment, article, cleanup, move, or delete actions.
- Queue draft receipt ledgers now show a lane manifest. Each receipt lane previews the first few sources, draft decision, next gate, blockers, and remaining source count so large whole-life batches can be reviewed by lane without attaching or embedding anything accidentally.
- Lane manifest previews now have per-source open actions. Reviewers can jump directly to any visible source in a receipt lane while the action remains navigation-only and still avoids receipt saves, attachment writes, graph sync, vector writes, article promotion, cleanup, moves, and deletes.
- Lane manifest previews now include source provenance chips. Each visible source shows source kind, Life Domain shelf, boundary state, extraction state, and file type so reviewers can triage large whole-life batches without opening every file first.
- Queue draft receipt lanes can now be selected as review batches directly from the lane manifest. The selection updates the archive-review queue and shows the selected count, but it remains a review-only handoff with no receipt save, attachment, Neo4j sync, Weaviate write, article promotion, cleanup, file movement, or deletion.
- Archive-review selections now preserve the selected draft lane receipt context. When a lane is selected, the batch review desk shows the lane label, originating queue, first review question, domain and next-gate chips, locked-gate contract, and an open-first-source action so reviewers know exactly why that batch exists before turning files into wiki memory.
- Selected draft-lane receipts now include a source-by-source checklist. The checklist shows the actual lane sources with review status, Life Domain shelf, next wiki gate, source kind, extraction state, file type, and per-source open actions while still avoiding receipt saves, attachments, Neo4j sync, Weaviate writes, article promotion, cleanup, file movement, or deletion.
- Selected draft-lane source rows now include a source-to-wiki gate strip. Each source shows boundary, shelf, extraction, evidence, Neo4j, and Weaviate states as done, active, or locked so reviewers can see the exact gate sequence before opening a source or approving durable memory.
- Selected draft-lane receipts now include a lane-level gate summary. The summary counts every selected source across boundary, shelf, extraction, evidence, Neo4j, and Weaviate gates, shows done/active/locked totals, and offers navigation-only open-first-gate-source actions for steering large review batches without saving receipts or writing graph/vector memory.
- Selected draft-lane receipts now surface a primary lane next move. The batch review desk chooses the first active gate across the selected lane, or the first locked blocker when nothing is active, and presents a navigation-only start-here card with the first source, gate counts, and a no-write contract before reviewers dive into the full checklist.
- Selected draft-lane receipts now include a source-to-wiki review runway. The runway turns the selected batch into an ordered boundary, shelf, extraction, evidence, Neo4j, and Weaviate sequence, labeling each gate as current, waiting, or cleared and opening only review surfaces without saving receipts, attaching records, writing vectors, syncing Neo4j, promoting articles, moving, cleaning, or deleting files.
- Selected draft-lane receipts now include a gate work packet. Each gate names the human decision, expected output, first source, and still-blocked writes so reviewers can move a whole-life batch toward wiki memory without confusing review packets with attachment, Neo4j, Weaviate, promotion, cleanup, move, or delete actions.
- Selected draft-lane receipts now include gate review prompts. Each prompt tells the reviewer what to inspect, what answer to record, and what proof makes that answer credible before any source becomes durable wiki memory or moves toward Neo4j/Weaviate gates.
- Selected draft-lane receipts now include an answer rubric. Each gate defines what accepted, held, and unlocked states mean, plus the receipt key that should eventually store the answer, so review decisions can scale without silently approving attachments, graph writes, vector writes, article promotion, cleanup, moves, or deletes.
- Selected draft-lane receipts now include draft receipt previews. Each gate shows the receipt key, draft state, source scope, reviewer answer field, evidence field, unlock result, and no-write stamp before any human decision is saved.
- Selected draft-lane receipts now include receipt save checkpoints. Each gate shows whether a human review save is ready, blocked, or audit-only, previews the receipt payload and required evidence, and repeats which attachment, graph, vector, article, cleanup, move, and delete writes remain blocked behind separate gates.
- Selected draft-lane receipts now include reviewer answer worksheets. Each gate shows the required answer state, decision options, suggested answer, evidence note, save blocker, and manual save target so reviewers can prepare durable receipts before any automatic attachment, graph, vector, article, cleanup, move, or delete action exists.
- Selected draft-lane receipts now include a visible source-to-article workup builder. The selected lane previews the candidate wiki title, lead, sections, citation packet, holdbacks, review state, approved/pending evidence, extraction gaps, and Neo4j sync state, then can launch the existing metadata-only article workup flow without publishing prose, attaching records, writing Weaviate vectors, syncing Neo4j, cleaning, moving, or deleting files.
- The active queue desk now includes a compact source-to-wiki conversion snapshot. It mirrors the source readiness ladder at queue-review speed, showing raw capture, boundary, shelf, extraction, evidence review, citation packet, draft/promotion, and backlink progress with a primary next action, while keeping publication, attachments, Weaviate writes, Neo4j sync, cleanup, moves, and deletes behind separate explicit gates.
- The active queue desk now also has a queue conversion workbench. It turns the selected source's next blocker into concrete review cards for current gate, document boundary, wiki shelf, evidence state, article packet, receipt trail, and locked write gates, so an operator can keep turning a file into wiki material without confusing document review with client/case attachment, article promotion, graph sync, vector writes, cleanup, moves, or deletion.
- Active review queues now include a generic source-to-wiki batch panel, even when the queue was not created from an article seed. It groups all queue sources into boundary review, wiki shelf, extraction, evidence review, article workup, graph/vector gates, and organized lanes, then opens or runs only bounded review-safe actions such as extraction-to-review-chunks or metadata-only article workup.
- Active review queues now also suggest queue topic candidates. The queue groups visible sources by Life Domain, collection shelf, and source kind, then shows candidate wiki pages with boundary, extraction, pending evidence, approved evidence, and receipt counts. Each candidate can open its source set or prepare a metadata-only topic workup without promotion, attachment, Weaviate writes, Neo4j sync, file movement, cleanup, or deletion.
- Source pages now expose an explicit embedding graph sync ledger. Reviewers can refresh the current embedding-review chunk state into Neo4j without changing chunk decisions, writing Weaviate vectors, attaching records, moving files, or cleaning up files; the UI shows graph status, node/edge counts, review node, vector-index node, and sync time.
- Source pages now include an embedding readiness checkpoint. It summarizes source extraction, chunk decisions, approved evidence, Weaviate dry-run state, Neo4j chunk graph sync, and vector-gate readiness in one place, then recommends the next safe action without writing vectors automatically.
- Life Domain pages now include a whole-life pipeline board. Domain sources are grouped into source review, extraction, chunk review, Weaviate dry-run, Neo4j graph sync, vector gate, indexed, excluded, and organized-only lanes with open-next and select-lane actions so operators can keep turning files into wiki material without hunting through separate panels. The source-review lane can build a 25-source human review packet for the current domain, preselecting the next unreviewed documents without attaching, embedding, moving, or cleaning up anything, and the archive review queue now shows a visible selected-packet receipt with sample source titles plus a one-click queue action that turns the packet into a named reviewer work queue. Queue open-next now focuses the source-review desk, narrows archive filters around the current source, and provides keep/flag/attach-and-open-next actions so reviewers can process queued source packets without hunting through the page. Source pages now show their own whole-life pipeline checkpoint with the next safe action for that exact source: open source decision, extract this source, review chunks, prepare dry-run, sync Neo4j, open vector gate, review exclusion, or view the vector ledger. The source archive-decision card also has keep/flag/attach-and-continue actions that save the review decision and immediately hand the source to its next review-gated stage, without writing live vectors, moving files, or cleaning anything up. The extraction lane can now run a bounded review-safe extraction batch directly from the domain board while still keeping sources standalone and writing no vectors. The dry-run lane can prepare reviewable Weaviate object previews for approved chunks in a bounded batch while keeping live vector writes off. The graph-sync lane can also refresh reviewed, dry-run-prepared chunks into Neo4j in a bounded batch without changing chunk decisions or writing Weaviate vectors. The vector-gate lane now opens the next ready source directly into the source-level Weaviate write review, resets the acknowledgement checkbox, and filters the chunk list to approved evidence so operators can decide what gets embedded before any live write.
- The Unknown Life Domain page now has a read-only triage panel. It groups unknown sources into cautious candidate domains using file names, paths, lanes, collections, parser text, graph entities, and archive metadata, then opens the next source for human classification without reclassifying, attaching, embedding, syncing graph data, moving files, or cleaning anything automatically.
- Unknown source pages now show their own Life Domain classification worksheet. The worksheet scores candidate domains, shows which source fields carried the evidence, and routes the reviewer to the source decision or extraction/chunk review surface while remaining read-only.
- Unknown source pages now also save a Life Domain classification decision receipt. A reviewer can accept, draft, reject, or ask for more evidence on a candidate shelf with a note and evidence fields, while still avoiding automatic Life Domain writes, attachments, embeddings, Neo4j sync, article promotion, file movement, cleanup, or deletion.
- Unknown Life Domain pages now include a classification receipt ledger. It rolls up saved source-page classification receipts, counts accepted/draft/needs-evidence/rejected decisions, shows proposed shelves and reviewer notes, selects the receipt sources, creates a reviewer work queue, or opens the next receipt source while still keeping all changes review-only.
- Unknown Life Domain pages now stage Life Domain move proposals from accepted classification receipts. Proposal packets show the exact source, current shelf, target shelf, blockers, and review impact before any source domain changes, graph sync, Weaviate write, attachment, article promotion, file movement, cleanup, or deletion can happen.
- Source pages now include a human-apply gate for ready Life Domain move proposals. The reviewer must acknowledge the exact impact before the app updates only the source's Life Domain shelf; vectors, Neo4j graph sync, attachments, article promotion, local files, cleanup, and deletion remain untouched.
- Unknown Life Domain move ledgers now stay useful after sources leave Unknown. Applied proposal receipts remain visible as progress, while select/queue actions focus only unresolved active proposals and an open-next action jumps to the next ready proposal source.
- Source pages that have already left Unknown now keep an applied Life Domain shelf receipt visible. The receipt can open the new shelf, return to the Unknown proposal ledger, or jump to the next unresolved proposal without changing graph, vector, attachment, article, cleanup, deletion, or file state.
- Applied Life Domain shelf receipts are now recovered from each source's archive metadata after reloads. If the frontend's temporary proposal list is missing or stale, the Case Wiki rebuilds the applied proposal receipt from the persisted source archive so the Unknown ledger and source page still reflect the actual reviewed shelf move without writing vectors, syncing Neo4j, attaching records, promoting articles, moving files, cleaning files, or deleting anything.
- Unknown Life Domain pages now build a cautious classification review packet from the next visible unknown sources. The packet can select the sources, create a reviewer work queue, or open the first source page while preserving source boundaries and still avoiding Life Domain writes, attachments, embeddings, Neo4j sync, file movement, cleanup, or article promotion.
- Manager follow-up reconciliation history is now a first-class Case Wiki review surface. The UI can load server-backed reconciliation decisions, filter by manager/status/decision, show missing/stale/recurring counts, and sync a selected manager decision into Neo4j as a review node without changing the underlying tasks or source documents.
- Source pages now include a non-destructive organization and cleanup decision panel. Reviewers can mark sources for cleanup review, possible duplicate comparison, superseded/old-copy handling, or exclusion from embedding without moving, renaming, or deleting local files.
- Source pages now include an initial canonical-source comparison flow. The UI compares possible duplicate sources by content hash, scanner duplicate group, file name, wiki title, and shared terms, then lets a reviewer mark the current source as canonical or superseded by another source with an audit trail. Confirmed canonical decisions now persist a durable source-family lineage record with canonical source, member sources, remembered aliases, hashes, duplicate-group keys, and reviewer evidence so later scans can recognize renamed or lightly reformatted copies before extraction or embedding.
- Archive review route tests now cover standalone review, valid attachment requirements, reviewed service attachment graph writes, do-not-embed archive decisions, canonical/superseded source decisions, and batch review guardrails.
- Batch archive review is now a first-class API action. It can update selected standalone source documents in one request, blocks bulk attachment by design, and skips already attached/current-record sources so existing client/case/service links are not silently detached.
- Custom document-library views can now save the current document filters, cleanup state, archive review filters, sort mode, owner, result count, and reviewable count. Reviewer-owned work queues can be created from a saved/custom document view or the current archive selection. Queues persist with the Case Management workspace, carry collaboration-ready metadata, track pending/reviewed progress from source review state, keep a queue event history, support owner reassignment/teammate assignment, carry SLA/due-date metadata, filter queue boards by due state, accept handoff comments, report review throughput/ETA, prepare metadata-only JSON/CSV/Markdown queue exports, set reassignment alert preferences, route notifications to in-app/digest/manager-board/email-draft targets without sending externally, show reviewer workload heatmaps with owner drill-downs, save queue dashboards, share or duplicate dashboards inside the Case Wiki workspace with viewer/editor/manager roles, enforce queue dashboard open/update/share/delete permissions through a viewing-as role lens, set reviewer capacity limits, track reviewer availability and backup coverage, route capacity warnings into the workflow notification inbox, let reviewers acknowledge or snooze capacity alerts, show six-week throughput trendlines with per-owner history, export owner-level throughput metadata, maintain queue health rules, apply import-size health templates, capture recurring review-board digest snapshots, compare digest snapshots, keep an audit history for downloaded queue/owner/manager manifests, generate board-level action recommendations, acknowledge/assign/escalate/complete those recommendations with due dates, save/run/pause/delete digest automation hooks, auto-run due digest hooks while Case Wiki is open, keep a digest automation run ledger, export or internally share the teammate manager-board snapshot, filter and save recurring manager-board views, share saved manager-board views with viewer/editor/manager roles, enforce saved manager-board view open/update/share/delete permissions through a viewing-as role lens, apply owner-capacity and availability escalation rules into manager follow-ups, group a manager-board view by teammate, escalate workflow notifications when deadlines age out, and can activate/open the next pending standalone source without bulk-attaching anything.
- Local archive scans now perform a privacy-conscious SHA-256 pass for eligible files. Credential-like files are skipped, large files are capped, exact-content duplicate groups are shown before ingest, and the cleanup workbench can stage a canonical copy without deleting anything.
- Local archive scans now perform a capped text-fingerprint pass for readable text-like files. Credential-like paths are skipped, large files are capped, near-duplicate text groups are surfaced in the cleanup workbench, and the app keeps them as review decisions instead of silently merging or attaching them.
- Local archive scans now carry Case Wiki source-history memory forward. Exact hash matches against already-ingested, canonical, or superseded source pages are labeled in the organizer and cleanup workbench so repeated scans do not treat remembered source families like brand-new files. The scanner can also use canonical lineage aliases and source-family terms to flag renamed or lightly reformatted matches as `source-family-match`, keeping them in a dedicated Source-family review pass before extraction or embedding.
- Local archive scans now assign every candidate a picky import decision before selection. The scanner separates `import-now`, `review-first`, `cleanup-first`, `lineage-review`, `defer`, and `quarantine` candidates, explains the reasons, and gives the UI a Picky recommended sources pass so the first whole-life import stays useful, standalone, and free of obvious duplicates, private-review material, development artifacts, and source-family repeats.
- The local archive manager now shows a selected-batch checkpoint after every scan. It counts selected `import-now`, `review-first`, `cleanup-first`, source-family, blocked, and stale items, tells the operator the next safe step, and keeps Select picky picks, Catalog selected, and Open review path in one place so whole-life imports can move from scanner picks to source-page cataloging without losing the review gates.
- Metadata-only cataloged source pages now preserve the scanner's picky import decision. Source records, generated notes, the source notebook, and the archive-decision panel can show the tier, score, action, and reasons that caused a file to be staged, so later extraction and embedding review keep the original selection logic visible.
- The Source-family review pass now has its own compare/review workbench in the local archive manager. Reviewers can inspect the matched canonical source, lineage aliases, prior family members, match score, and candidate file metadata, then choose `merge into family`, `keep separate`, or `reject duplicate`. These choices persist to the Case Management workspace as a source-family review ledger with graph-ready node ids and audit records, while still only affecting the staging batch: merge/reject keeps the local candidate out of ingest, keep-separate allows it to become its own source page, and none of the choices move files, delete files, write vectors, attach records, or mutate Neo4j by themselves. Separate explicit single and batch `Sync to Neo4j` actions now write only the reviewed source-family decision layer into the knowledge graph as `SourceFamilyReviewDecision`, `LocalArchiveCandidate`, `SourceFamilyLineage`, canonical source/page, and reviewer nodes so large whole-life imports can reconcile many reviewed family decisions at once without embedding or attaching anything.
- Local archive scans now support a larger whole-life folder pass across Desktop, Documents, Downloads, and Projects, while skipping runtime noise such as OrbStack/docker folders and `.log` files.
- Local archive candidates can now be cataloged as metadata-only standalone Case Wiki source pages before full extraction. This writes source/page/domain/collection graph structure to Neo4j and the app database without writing Weaviate vectors or silently attaching anything to clients/cases.
- Cataloged local archive source pages now have a review-gated extraction step. A reviewer can extract the local file into wiki sections and pending embedding-review chunks while preserving the standalone source boundary; vectors still are not written until chunk review and Weaviate dry-run approval happen separately.
- The archive review queue now supports batch extraction for selected cataloged local archive sources. The batch result separates processed sources, sources that produced review chunks, metadata-only sources that still need stronger parsers, skipped sources, failed sources, and total review chunks so the UI does not overstate parser readiness.
- Source extraction needs stronger parsers for very large batch imports, deeper Apple iWork body extraction, and actual speech-to-text transcription for raw media. Scanned PDFs, email messages, email archives, contacts, calendars, browser/bookmark exports, JSON/HTML exports, saved web links, subtitle/caption transcripts, media-file staging, and Apple iWork package metadata now have first-pass parsers, but the review desk should still show parser confidence and missing-content warnings.
- Deduplication now has exact content hashes for eligible local archive candidates, ingested source pages, first-pass near-duplicate text similarity for local text-like files, source-history carry-forward for canonical/superseded decisions, canonical lineage matching across renamed or lightly reformatted source families, a source-family compare workbench, server-saved source-family review decisions, and a batch source-family Neo4j sync lane so these matches do not enter clean ingest or generic cleanup by accident. It still needs richer family-resolution UX for very large canonical clusters.
- Extracted source pages now include a canonical group history panel. Reviewers can see whether the current source is preferred, superseded, or still undecided, inspect copies that already point to it, open possible duplicate sources, prefer another source, or resolve visible duplicate candidates under the current source without moving, merging, embedding, or deleting local files. The panel now surfaces durable source-family memory: remembered aliases, lineage members, remembered hashes, group id, and evidence explaining why future scans should recognize the family.
- Extracted source pages now also include a metadata-only article consolidation plan. Reviewers can group related standalone source pages under a target article candidate while keeping every original source page intact; the plan explicitly blocks article prose writes, vector writes, Neo4j writes, attachments, and file cleanup until citation review and promotion happen separately.
- Article consolidation now has a citation review packet step. The packet compiles approved chunks, pending chunks, blocked chunks, metadata-only sources, source summaries, and the promotion gate for a planned article while keeping every source page intact. It writes only source metadata and still blocks article prose, vectors, Neo4j writes, attachments, and file cleanup.
- Citation packets can now produce a deterministic reviewed article draft preview. The preview creates lead/evidence/coverage/gap sections from approved chunks only, stores the scaffold as source metadata, keeps human promotion separate, and still avoids model calls, vector writes, Neo4j writes, attachments, file movement, deletion, or permanent article publication.
- Reviewed article draft previews can now run a split-specific article review. The review identifies when one broad source should become several cleaner article candidates, shows citation-backed split sections and keep-together reasons, and remains source metadata only with no article publication, vector writes, Neo4j writes, attachments, file movement, or deletion.
- Reviewed article draft previews now have a promotion readiness checklist. The checklist verifies reviewed citation coverage, section readiness, pending chunks, excluded chunks, warnings, and human-confirmation requirements without publishing the article or writing vectors, Neo4j graph data, attachments, files, or cleanup actions.
- Readiness-approved article drafts can now be promoted as permanent Case Wiki topics through a separate human-confirmed article promotion action. The promotion writes the reviewed article record and Neo4j article graph, keeps source pages intact as citations, excludes context/review-gap sections from article prose, and still blocks vectors, client/case attachments, file moves, deletion, and cleanup actions.
- Standalone source documents can now start the article path without needing a visible merge candidate. The single-source article plan keeps the original source page intact, records a metadata-only article candidate, and lets the same citation review, draft preview, split review, readiness, and human-confirmed promotion pipeline turn a useful file into a proper Case Wiki article.
- Source pages now have a one-click source-to-article workup preview. It prepares the standalone/merge article plan, citation packet, reviewed-citation draft preview, and promotion-readiness checklist in one metadata-only pass, while still requiring a separate human confirmation before any article promotion and still blocking vectors, attachments, file movement, deletion, cleanup, and model calls.
- Article workups now surface pending evidence directly inside the article panel. Reviewers can inspect current-source chunk previews, approve or skip individual chunks, jump the chunk review panel to pending items, or approve the current source's pending chunks and immediately rebuild the workup. This creates reviewed citation metadata and Weaviate dry-run previews only; it still does not write live vectors or publish article prose.
- Personal archive file cleanup is only advisory. The app does not yet have a safe quarantine, move, rename, or delete workflow.
- Guarded cadence automation now exists for the active campaign. It can save hourly/daily/weekly/manual checks, evaluate due campaign work on the server, reconstruct selected source files from the saved workspace, and optionally start selected-source ingest only when guarded ingest is enabled. A saved-workspace daemon queue now exposes which lanes could run unattended, why they are blocked/paused/not due, and how many selected source files the server can resolve without the browser. A first closed-browser daemon pass now exists: the UI can run a server-owned pass against the saved workspace, and the API can wake active automation workspaces from a disabled-by-default interval controlled by `CASE_WIKI_LOCAL_ARCHIVE_DAEMON_ENABLED`. The default pass plans and audits; ingest only starts when `CASE_WIKI_LOCAL_ARCHIVE_DAEMON_EXECUTE=true`, guarded ingest is enabled, and the current saved selected-source batch has been explicitly confirmed when review-before-run is on. Daemon passes now write a persistent run ledger into the workspace so the operator can review checks, blocked states, ready lanes, selected-source counts, confirmation-required states, and started jobs after reload. The daemon queue now also shows the server environment gates, dry-run/live-run mode, interval, batch limit, Weaviate vector gate, and workflow-inbox handoff signals before any unattended import is enabled. A controlled live-run rehearsal check now exists beside the daemon queue; it resolves saved selected sources from server metadata, enforces a tiny first batch, reports every live-run blocker, and confirms that the check itself does not ingest, delete, move, or vectorize anything. The operator can now create a temporary 1-3 source rehearsal overlay from the larger whole-life selection and restore the full batch afterward; this keeps the big archive plan intact while the first watched daemon run stays tiny. The rehearsal panel now includes a watched launch checklist: tiny server-resolved batch, exact batch confirmation, operator run gates, live daemon environment, one watched pass, then inspect-before-scale.

## Latest Local Scan Notes

2026-05-02 local dry run:

- First direct host scan against `/Users/joel` returned 800 high-priority candidates from 5,000 buffered discoveries.
- The first pass surfaced useful Street Voices, partner, grant/agreement, systems innovation, case-management, project, and creative materials.
- The scan also proved that a raw home-folder pass is too noisy unless runtime folders are skipped. OrbStack/docker logs dominated the first result set, so the scanner now excludes that runtime layer and `.log` files from whole-life archive scans.
- Three credential-like files were detected and blocked from normal ingest. This confirms the quarantine rule is doing useful work.
- Vector writes remain off. The next correct move is metadata-only cataloging, then review/extraction, then embedding approval.
- Live Chrome verification confirmed the batch extractor can process selected local archive sources from the review queue while keeping vectors off. In the latest checked batch, 12 sources were processed, 4 produced 96 review chunks for Weaviate approval, and 8 stayed metadata-only for stronger parser follow-up.
- Generated app/build folders are now excluded from whole-life scans by directory pattern, including `dist-*`, `build-*`, `.output`, `.turbo`, `.vite`, and Storybook output. This prevents bundled app images and generated assets from polluting the user's life wiki queue.
- The app container now installs Poppler `pdftotext` and Tesseract OCR tooling. Live extraction of `TPL Collaborative Program Agreement Street Voices April May 2026.pdf` used `pdftotext`, produced 24 review chunks, wrote 15 graph nodes and 14 graph edges through the Neo4j writer, and kept Weaviate as a review-only target with no automatic vector writes.
- The 24-chunk `TPL Collaborative Program Agreement Street Voices April May 2026.pdf` source now has a review workbench that shows every chunk, searches within the chunk set, filters by status, supports filtered batch decisions, and lets the reviewer edit/redact individual chunk text and privacy/redaction metadata before re-approval. Browser verification kept vector writes at zero. A live Weaviate write button is now present only after a prepared dry-run, and it still requires an explicit reviewer acknowledgement plus server-side write gates.
- Live browser verification confirmed embedding-review graph writeback: resetting and re-approving a prepared source chunk created one `EmbeddingReview`, one `EmbeddingChunk`, and one `VectorIndex` node in Neo4j, restored the source to `ready-for-vector-dry-run`, and kept Weaviate vector writes at zero.
- Backend verification now covers reversible vector deletion. The write path persists object IDs/object maps/object fingerprints, and the delete path refuses unconfirmed deletes, then records deleted object IDs and clears the active vector index ledger after a confirmed successful delete.
- The source page UI now exposes a vector ledger and rollback panel. It shows the saved Weaviate object count, ledger rows, collection, fingerprint, write/delete timestamps, object ID preview, and a separate destructive-action acknowledgement before calling the confirmed delete route.
- Scanned/image-only PDFs now have an OCR fallback. If `pdftotext` finds no embedded text, the extractor renders the first pages with Poppler `pdftoppm`, runs Tesseract OCR on the rendered images, and turns the OCR text into review chunks instead of leaving the source metadata-only. Parser commands are configurable through `CASE_WIKI_PDF_TEXT_COMMAND`, `CASE_WIKI_PDF_RENDER_COMMAND`, and `CASE_WIKI_OCR_COMMAND` for safer deployment and testing. Live Chrome/API smoke verification used an image-only `whole-life-ocr-smoke.pdf`; it extracted with `pdf OCR (pdftoppm + tesseract)`, produced a review chunk, wrote Neo4j graph records, and kept Weaviate behind human approval.
- Structured life files now get a readable first pass before embedding review. `.eml` email messages, `.ics` calendar exports, `.vcf` contact cards, `.html` pages, and `.json` exports are normalized into wiki-friendly source text with parser metadata so they can be searched, graphed, chunk-reviewed, and kept standalone until the user attaches or embeds them.
- Mailbox archives and Apple iWork files now enter the same source-first pipeline. `.mbox` files are summarized as email archives with message subjects, senders, dates, and body previews; `.pages`, `.numbers`, and `.key` files are detected by the local archive scanner, with `.pages` treated as readable documents, `.numbers` as tables, and `.key` as presentations. The first iWork parser preserves package entries and metadata as reviewable wiki source text, warns that full body extraction still needs a deeper parser/export pass, and keeps Weaviate writes behind human chunk approval. Live API smoke verification against `localhost:3180` confirmed `.mbox` and `.pages` preview uploads return ready standalone source records, Weaviate review status, and Neo4j graph previews without persisting test records.
- Browser bookmarks and saved web links now have a dedicated source class and lane. Netscape bookmark HTML exports, Chrome/Safari-style bookmark JSON exports, macOS `.webloc` files, and `.url` internet shortcuts are parsed into saved-link wiki source text with titles, URLs, folders, and timestamps when available. The scanner classifies these as `Browser bookmarks and web research` in the Research domain before case/client keyword matching, so a link named `Case Wiki.url` remains saved web research until a person explicitly attaches it elsewhere. Live API smoke verification against `localhost:3180` confirmed bookmark HTML, bookmark JSON, `.url`, and `.webloc` preview uploads all return ready standalone Research-domain bookmark records with Weaviate review status and Neo4j graph previews.
- Audio/video material now has a review-safe first pass. `.vtt` and `.srt` caption files are parsed into timed transcript wiki text; common audio/video files such as `.mp3`, `.m4a`, `.wav`, `.mp4`, `.mov`, `.mkv`, and `.webm` are discovered by the local archive scanner and staged as standalone media sources with `Needs transcript review` collections. Raw media stays metadata-only until a transcript is attached or generated, which prevents the system from pretending audio/video content has been understood.
- Live Case Wiki verification confirmed the active import campaign can scan the computer archive, save a campaign checkpoint, and reopen that checkpoint. The verified browser run scanned 5,000 discovered files, returned 800 candidate sources, preserved a selected batch of 12, and restored those 12 selected sources from the current scan.
- Server autosave now stores a compact local-archive scan snapshot so whole-life scans do not exceed the API's JSON payload limit. The browser keeps the full live scan locally, while Street Voices stores campaign metadata, checkpoint history, and the selected batch needed to resume safely.
- The active import campaign now exposes the underlying server ingest job directly: selected local files can start a background ingest from the campaign card, through the backend-owned campaign runner, through a saved-workspace server tick, through a saved-workspace daemon queue preview, through a saved-workspace daemon pass with persistent run history, or through guarded campaign automation when the due check is explicitly allowed to execute. The campaign shows an import lane board for staged, running, needs-review, completed-source, and quarantined work, a campaign lane command center for switching between focused archive passes, a metadata-only campaign schedule preview saved to the workspace with an audit event, a run-next-step coordinator that follows the safest current schedule action, job progress and recent files, pause/resume/retry controls call the durable Case Wiki job endpoints, a selected-source confirmation gate for unattended daemon ingest, operator-facing dry-run/live-run environment visibility, workflow handoff signals, a controlled live-run rehearsal checklist with a temporary rehearsal-batch overlay and watched launch path, and a recent campaign job ledger can reopen prior ingest jobs without duplicating the batch. Reloaded queued/processing jobs poll until terminal state and merge completed source pages back into the wiki workspace. Extracted sources can now move into a full article workup from the source page without the reviewer manually stepping through every safe metadata-only stage.
- Life Domain pages now include an article seed planner. It groups standalone sources by collection/lane, shows review gaps, approved chunks, metadata-only counts, and sample source titles, then can launch a source-to-article workup or create a named reviewer queue for the exact seed sources from the domain page while preserving source boundaries. Seed reviewer queues remember their article context, show a readiness checklist for boundary review, extraction gaps, pending chunks, and approved evidence, surface the next blocked source pages in priority order, and can build a source-to-article workup from the active queue after review. This does not attach documents to clients/cases, promote prose, write vectors, move files, or clean up files.
- A first retrieval workbench now lives inside the Case Wiki article view. It searches the wiki/source index, Neo4j graph context, reviewed chunk text, and Weaviate hybrid search only when sources have approved live vector object IDs. When vectors are still review-only, the UI says Weaviate is inactive instead of pretending semantic memory is ready.
- Retrieval now returns a wiki answer-draft envelope: reviewed citations, candidate citations, article outline sections, warnings, and next editorial actions. Drafts stay blocked as `needs-review` until at least one matching chunk is approved or returned from live Weaviate, so pending source material can guide review without becoming a settled article.
- Candidate and reviewed answer citations now open the exact source chunk inside the existing embedding review workbench. The focused chunk is preserved in the URL as `chunk=...`, highlighted in the chunk list, and gets direct approve / do-not-embed / edit-redact actions so retrieval can feed the human evidence gate instead of becoming a separate, unreviewed answer layer.
- Focused evidence review now closes the loop back to retrieval. A reviewer can approve or mark the focused chunk as do-not-embed and immediately refresh the current answer draft, so reviewed chunks move from candidate evidence to draft-ready evidence without manually rerunning the same search.
- Retrieval answer drafts now include a deterministic promotion preview. Candidate-only searches show why promotion is blocked; reviewed searches produce a preview-only article lead, section plan, citation ledger, and publication checklist so reviewed evidence can move toward permanent wiki sections without auto-publishing or using uncited synthesis.
- Reviewed retrieval drafts now have a human-confirmed promotion write path. The UI keeps promotion disabled for candidate-only searches; when reviewed citations are present, a reviewer can promote the deterministic preview into a persistent Case Wiki topic record with a citation ledger, workspace audit record, and Neo4j `WikiPromotion`/`WikiPage`/`WikiSection`/`CITES` graph metadata. This still does not attach source documents to clients/cases, approve pending chunks, write vectors, move files, or delete anything.
- Promoted Case Wiki topics now keep a reversible version trail. Re-promoting the same reviewed topic updates the stable wiki page instead of duplicating it, saves the replaced article as a prior revision, writes the current version metadata to Neo4j, and exposes a human-confirmed rollback action that restores an older promoted article while preserving the replaced version in history. Rollbacks do not attach sources, approve chunks, write vectors, move files, or delete anything.
- Retrieval now includes an explainable evidence-ranking ledger. Weaviate reviewed vectors rank first, approved chunks rank next, candidate chunks stay visible as review leads, and Neo4j/source graph hits are clearly marked as context-only until reviewed chunk evidence exists. The Case Wiki UI shows the score, confidence state, source layer, and reasons for each ranked match so larger whole-life imports remain auditable instead of becoming a black box.
- Retrieval answer drafts now include a citation-constrained synthesis envelope. The deterministic draft marks synthesis `ready` only when every synthesized section cites reviewed evidence; candidate chunks and graph-only matches stay visible as review context but are blocked from article prose until a human approves the underlying chunks.
- Model-draft pages now expose an explicit external adapter launch gate. Reviewers select the provider class and model/endpoint label before checking readiness or preparing consent, and the chosen target is written into readiness/consent metadata while still blocking source transmission, live model calls, vectors, Neo4j writes, attachments, file moves, and promotion until separate action-time consent exists. The server readiness contract also blocks `not-selected` provider/model targets so consent cannot be prepared from an unnamed adapter.
- Promotion previews now include a citation coverage diff before any permanent wiki write. The diff separates promotable reviewed sections from candidate/context sections held back for review, shows excluded evidence, compares synthesis citations against the promotion ledger, and blocks promotion if a publishable section is uncited or uses unreviewed citation ids.
- Citation-constrained synthesis now exposes a model-writing packet without making a model call. The packet shows reviewed citation context, allowed citation ids, excluded candidate ids, section plans, guardrails, prompt messages, and the output contract a future model-backed prose step must obey before any human-confirmed promotion.
- Reviewed model-writing packets now have a disabled-by-default draft preparation route. The route accepts only `ready` reviewed-citation packets, rejects candidate-only or uncited section plans, saves a reviewable `Model draft` wiki page with coverage diff metadata, and explicitly records that no external model call, source transmission, promotion, vector write, file move, or client/case attachment happened.
- Saved model drafts now have a local adapter rehearsal route and UI panel. The rehearsal consumes only the saved draft packet, validates every output citation id against the reviewed citation ledger and coverage diff, records that no external model call/source transmission/vector write/Neo4j write/promotion happened, and still leaves human promotion confirmation as a separate gate.
- External model adapters now have a read-only readiness preview. The preview requires a saved passing local rehearsal first, lists exactly which reviewed-citation fields would be candidates for source transmission after consent, confirms full files/candidate evidence/graph-only context stay excluded, and keeps the actual external call disabled until a separate action-time consent path exists.
- External model adapters now have a saved consent-packet step. The packet records the provider/model placeholder, reviewed citation excerpt candidates, excluded fields, transmission fingerprint, and consent checklist while still confirming no model call, source transmission, vector write, Neo4j write, promotion, file move, deletion, or attachment happened.
- External model adapters now have a local request-rehearsal guard. The guard assembles the exact provider/model request envelope from the saved consent packet for review, records the remaining blockers, and still keeps source transmission, model calls, vector writes, Neo4j writes, promotion, file moves, deletion, and attachments disabled.
- External model adapters now have a returned-citation output validator. The validator can run against a local sample output or a future adapter response, checks every returned citation id against the consent packet's reviewed citation ids, and still keeps model calls, source transmission, vector writes, Neo4j writes, promotion, file moves, deletion, and attachments disabled.
- Returned adapter output can now be captured manually in the model-draft page as JSON sections or Markdown, then validated against the saved request rehearsal's reviewed citation ids. The capture path records whether output was received for validation while still not calling a model, not transmitting source text from the app, not writing vectors, not writing Neo4j graph data, not promoting articles, not moving files, and not attaching documents.
- Validated returned adapter output now renders as a review-only draft packet inside the model-draft page. Reviewers can inspect each returned section, citation pass/fail state, returned prose, and human-review gate before any separate promotion action is considered.
- Validated returned adapter output can now be staged as a persistent editorial review packet. The packet records section-level wording, citation ids, `needs-human-review` decisions, checklist items, and audit history while still blocking article promotion, client/case attachment, Weaviate vector writes, Neo4j graph writes, file movement, deletion, and source transmission.
- Returned output editorial review packets now have a human decision layer. Reviewers can mark the returned sections ready for a separate promotion gate or send them back for revision; the decision updates only the review packet and audit trail, keeping article publication, client/case attachment, Weaviate writes, Neo4j writes, file operations, and source transmission blocked.
- Returned output that passes editorial review now has a separate promotion-readiness packet. The packet checks section decisions, citation ids, missing prose, unknown citations, and human-confirmation requirements before any later publication step; it still does not publish prose, attach records, write Weaviate vectors, write Neo4j graph data, move files, delete files, or transmit source text.
- Returned output that passes promotion readiness can now be human-confirmed into a permanent Case Wiki topic record. The publish gate preserves the approved returned sections and reviewed citation ids in `wikiPromotionRecords`, adds an audit receipt, and marks the review packet as published while keeping Weaviate writes, Neo4j writes, client/case attachments, source transmission, file movement, deletion, and embedding blocked behind later gates.
- Published returned-output topics now have their own Neo4j sync gate. The graph-sync action writes only the already-published topic, sections, and citation relationships to the Case Wiki graph, then stamps the publication receipt with node/edge counts while keeping Weaviate vectors, attachments, source transmission, cleanup, file movement, and deletion off.
- Neo4j-synced returned-output topics now appear in the Case Wiki graph search as first-class promoted wiki topics. Search results can open the durable promotion page, show publication mode, version, citation/section counts, and Neo4j status alongside source-document graph results.
- Promoted topic version history now shows a compare-before-restore diff for each saved revision. Reviewers can see title, lead, section, citation, and metadata changes before using rollback, keeping the wiki article trail auditable as whole-life topics evolve.
- Promoted topics now have their own wiki-index library controls. Reviewers can filter durable articles by saved revisions, Neo4j sync state, returned-output publication mode, retrieval-origin topics, and citation warnings; sort by recency, title, version, or citation count; open the next matching topic; and search promoted topic version histories/citation diffs from the global wiki search without publishing prose, writing vectors, syncing Neo4j, touching files, or attaching anything to case records.
- Each promoted topic now shows a maintenance checklist inside the article view. The checklist summarizes reviewed citations, section count, citation coverage warnings, version trail health, Neo4j topic-graph sync state, and the next safe action while remaining read-only; it does not publish prose, write vectors, sync Neo4j, attach sources, or touch local files.
- Source pages now show promoted-topic backlinks. A source can prove which durable wiki topics cite it through source IDs, page IDs, reviewed citations, embedding chunk IDs, Weaviate object IDs, and promotion version history while remaining a standalone document until a reviewer explicitly attaches it.
- Source pages now include a source-to-wiki route panel. The panel summarizes boundary, wiki shelf, extraction, article plan, citation packet, draft/promotion state, published backlinks, and the next safe article-building action so a reviewer can move a file toward durable wiki prose without silently attaching records, publishing text, writing vectors, syncing Neo4j, moving files, or cleaning files.
- Source pages now include an article blocker desk. It turns the source-to-wiki route into specific blockers, including source-boundary review, unknown Life Domain, missing extraction, pending chunks, missing citation packets, metadata-only evidence, readiness blockers, human-promotion confirmation, and backlink verification, with jump actions into the existing review surfaces while staying read-only.
- Source pages now include a source-to-article readiness ladder. The ladder shows the file's progress from captured source page through boundary review, Life Domain shelf, text extraction, evidence review, citation packet, draft preview, promotion readiness, promoted article, and backlink verification, with a next-step action that only navigates to existing review panels.
- Source pages now include an article neighborhood panel. It pulls the anchor source, saved consolidation candidates, related source documents, and possible duplicate/alternate-copy signals into one read-only surface so reviewers can see which files may belong in the same wiki article or source family before building durable topic prose.
- The article neighborhood now includes a topic assembly packet. It rolls up boundary reviews, approved evidence, pending chunks, metadata-only sources, duplicate/alternate-copy signals, and attached-record signals, then points to the next source or jumps into the current source's review surface without merging articles, attaching records, writing vectors, syncing Neo4j, or touching files.
- Source neighborhoods now render a topic article blueprint. The blueprint turns the current source family into a Wikipedia-style title, lead, section outline, source summary, citation summary, and review-question list so files can be shaped into readable wiki topics before any promotion, attachment, vector write, Neo4j sync, file move, or deletion.
- Topic blueprints now include a section evidence map. Each proposed wiki section shows citation support, mapped source titles, and the remaining blocker so reviewers can see exactly what evidence must be confirmed before the section becomes durable prose.
- The section evidence map now drills into citation snippets. Supported sections show reviewed citation/source previews, while unsupported sections show pending-evidence hints so reviewers can see what to approve before prose becomes durable.
- Topic blueprints now include an article readiness brief. It counts ready sections, blocked sections, citation snippets, and evidence gaps, then points to the next safe existing review surface without promoting prose, attaching records, writing vectors, syncing Neo4j, moving files, deleting files, or transmitting source text.
- Topic blueprint sections now carry their own next-step controls. Each section can route a reviewer to boundary review, chunk review, extraction/pipeline review, source-family review, or the article builder based on the specific blocker for that section, while still only navigating existing review surfaces.
- Topic blueprints now include a source coverage matrix. The matrix shows each source in the article neighborhood, which proposed sections it supports, reviewed citation counts, approved/pending chunk counts, current blocker, and a safe navigation action so source families can be audited before any durable wiki article is promoted.
- Topic blueprints now include integrity checks. The checks flag missing citation ids, unsupported sections, unresolved source boundaries, unmapped neighborhood sources, pending chunks, metadata-only extraction gaps, source-family lineage signals, and reviewed citations that have not been placed into sections before any article promotion can be trusted.
- Topic blueprints now include a promotion decision checkpoint. The checkpoint turns source-boundary review, evidence mapping, citation review, source-text coverage, source-family warnings, draft preview state, promotion-readiness state, and human confirmation into explicit blocker/warning/ready gates with navigation-only actions before any durable wiki article is promoted.
- Topic blueprints now include a semantic-memory checkpoint. The checkpoint rolls up all visible sources in the article family, showing source boundaries, extraction coverage, chunk-review decisions, approved chunks, Weaviate dry-run previews, Neo4j chunk-graph sync, vector-gate readiness, and embedding exclusions before any source family is trusted for retrieval.
- Topic blueprints now include a wiki-partition checkpoint. The checkpoint audits all visible sources by Life Domain, collection shelf, source scope, attachment target, client/case target, source kind, and unresolved boundary reviews so standalone documents, client profiles, case records, project files, and whole-life sources do not get blended into one wiki article or semantic-memory family without review.
- Topic blueprints now include a read-only wiki split plan. The plan turns partition pressure into concrete article routes, including unknown-domain review, Life Domain splits, collection shelves, attachment targets, client/case pages, source-kind notebooks, boundary-review queues, or a keep-together route, so whole-life imports can become separate wiki pages before promotion, graph sync, vector trust, attachment, cleanup, or file movement.
- Source pages now recover selection provenance for older local-archive records that were cataloged before explicit picky-import metadata existed. The archive decision and source notebook show a recovered tier, score, action, and reasons derived from existing archive metadata, so old source pages are not silent about why they entered the wiki.

## Target Data Model

### Core Nodes

- `SourceFile`: original file or pasted source.
- `SourceDocument`: normalized source record with provenance, parser state, privacy settings, and review state.
- `WikiPage`: human-readable synthesized page.
- `WikiSection`: lead, summary, timeline, claims, citations, notes, and extracted sections.
- `Claim`: a statement extracted from a source, with confidence and citation.
- `Person`: client, case manager, partner contact, or other human entity when confirmed.
- `StreetProfile`: linked Street Voices profile record.
- `Case`: case-management case.
- `Service`: service directory entity.
- `Project`: project, grant, initiative, or workflow.
- `LifeDomain`: top-level domain such as Personal, Street Voices, Case Management, Projects, Creative, Research, Admin, Services, Partners, or Unknown.
- `Collection`: user-facing shelf or folder-derived collection inside a domain.
- `Organization`: partner, funder, service provider, vendor, coalition, or institution.
- `Topic`: theme such as housing, identity, legal, food, employment, grants, media, systems innovation.
- `TimelineEvent`: dated event, milestone, appointment, note, document event, or source-change event.
- `EmbeddingChunk`: reviewed chunk prepared for Weaviate.
- `ReviewDecision`: human decision about attachment, embedding, redaction, cleanup, or deletion.

### Core Relationships

- `GENERATED_FROM`: wiki page or section generated from source.
- `CITES`: claim or section cites a source.
- `MENTIONS`: source/wiki page mentions person, topic, organization, service, project, or date.
- `ABOUT_CLIENT`: reviewed attachment to a client.
- `ABOUT_CASE`: reviewed attachment to a case.
- `ABOUT_SERVICE`: reviewed attachment to a service directory record.
- `ABOUT_PROJECT`: reviewed attachment to a project or workflow.
- `PART_OF_ARCHIVE`: source belongs to the whole-life archive.
- `CLASSIFIED_AS`: source belongs to an archive lane or collection.
- `IN_DOMAIN`: source/wiki page belongs to a life domain.
- `IN_COLLECTION`: source/wiki page belongs to a user-facing collection.
- `HAS_CHUNK`: source/wiki section has an embedding chunk.
- `EMBEDDING_APPROVED`: user approved chunk for vector indexing.
- `INDEXED_IN`: chunk was written to Weaviate.
- `SUPERSEDES`: newer document/version replaces older one.
- `DUPLICATE_OF`: likely or confirmed duplicate.
- `NEEDS_REVIEW`: source, page, claim, or chunk needs user review.

## Weaviate Plan

Use Weaviate for reviewed semantic chunks, not raw whole-life file dumps.

Collection proposal:

- `CaseWikiChunk`
  - `chunkId`
  - `sourceDocumentId`
  - `wikiPageId`
  - `sectionId`
  - `chunkText`
  - `chunkSummary`
  - `sourceTitle`
  - `sourcePathHash`
  - `lifeDomain`
  - `collections`
  - `sourceKind`
  - `privacyLevel`
  - `redactionMode`
  - `reviewStatus`
  - `embeddingApprovedBy`
  - `embeddingApprovedAt`
  - `entityIds`
  - `topicIds`
  - `caseIds`
  - `clientIds`
  - `serviceIds`
  - `projectIds`
  - `createdAt`
  - `updatedAt`

Search modes:

- Exact source search for titles, names, dates, IDs, and emails.
- Semantic search for "what was that document about?"
- Hybrid search for mixed exact and fuzzy queries.
- Filtered search for privacy level, reviewed status, source type, collection, person, case, service, project, and timeline range.

Required user controls before first real whole-life embedding:

- Show extracted chunks before write.
- Let user remove chunks from an embedding batch.
- Let user mark chunks as private, case-team, public, or do-not-embed.
- Show estimated chunk count and source list.
- Persist an audit event for every embedding approval.
- Keep credential-like files blocked until a redaction/quarantine flow exists.
- Require selected-source confirmation before unattended daemon ingest starts, so a saved batch cannot run just because the cadence, mode, and guarded-ingest toggle are active.

Embedding policy:

- Case-management records can be embedded only after source review and privacy confirmation.
- Personal/general-life sources can be embedded only after the user approves the domain, privacy level, and chunk list.
- Unknown-domain sources stay searchable by metadata and source page, but should not be embedded until reviewed.
- Sensitive domains such as identity, finance, medical, legal, credentials, private correspondence, and family/personal records require stricter defaults.

## Ingestion Pipeline

The desired pipeline:

1. Discover
   Scan mounted roots, browser uploads, pasted notes, exports, directory imports, or future connectors.

2. Stage
   Create source candidates with path, hash, file type, modified date, size, lane, cleanup signals, and import readiness.

3. Domain
   Classify each source into a life domain, collection, source kind, and privacy default. This happens before client/case/service/project attachment.

4. Extract
   Pull text, tables, metadata, OCR, embedded dates, and basic entities. Store parser status and warnings.

5. Redact
   Apply privacy-level and redaction settings before generating wiki text or semantic chunks.

6. Source Page
   Create a standalone source wiki page with provenance, extracted lead, parser notes, archive lane, graph preview, and review status.

7. Graph Write
   Write source, wiki page, domain, collection, lane, topic, mention, and semantic-index placeholder nodes into Neo4j.

8. Review
   Human confirms whether the source stays standalone, attaches to a live record, gets flagged for later, or should be excluded.

9. Chunk Review
   Generate proposed embedding chunks. User can approve, redact further, exclude, or postpone.

10. Vector Write
   Approved chunks go to Weaviate with metadata. Neo4j receives `EmbeddingChunk` and `INDEXED_IN` relationships.

11. Wiki Synthesis
   Create or update readable pages: client pages, project pages, source pages, service pages, topic pages, timelines, and indexes.

12. Retrieval
   Query combines wiki index, Neo4j graph traversal, and Weaviate hybrid search.

13. Maintenance
   Deduplicate, supersede, archive, quarantine, or clean files with explicit user approval.

## UI Requirements

Keep all of this inside `/case-management/knowledge`.

Main views needed:

- Wiki Index
  Searchable encyclopedia index with Life Domains, Clients, Cases, Services, Projects, Documents, Topics, Sources, Collections, and Recent Changes.

- Source Inbox
  Every ingested source and computer-scanned file lands here first.

- Local Archive Manager
  Scan folders, organize candidates, assign life domains, review duplicates, quarantine sensitive files, and choose staged imports.

- Review Queue
  Human review for standalone source docs, suggested attachments, and batch safe decisions.

- Embedding Review
  Preview chunks, redact/exclude/approve, then write to Weaviate.

- Life Domains
  A high-level organizer for Personal, Street Voices, Case Management, Projects, Creative, Research, Admin, Services, Partners, and Unknown. This is how the same system supports whole-life use without polluting client/case records.

- Graph Browser
  Interactive Neo4j-backed graph with filters for domain, collection, person, case, service, project, source, topic, date, and review status.

- Wiki Page
  Wikipedia-style page with lead, sections, citations, backlinks, source notebook, timeline, related pages, graph neighbors, and review state.

- Cleanup Manager
  Duplicate groups, old exports, screenshots, downloads, large files, and possible moves/deletions. No destructive action without confirmation.

## Safety And Privacy Rules

- Never silently attach personal documents to clients or cases.
- Never embed credential-like files.
- Never embed a source before the user can inspect the chunks.
- Never delete, move, rename, or share local files without explicit action-time confirmation.
- Keep raw source provenance visible.
- Every AI-generated wiki claim needs source traceability or a visible "needs source" state.
- Treat inferred client/case/service links as suggestions until reviewed.
- Keep personal whole-life archive records separate from Street Voices operational case records unless the user explicitly attaches them.
- Keep general-purpose life records out of client/case views unless a reviewed attachment exists.
- Unknown-domain sources should default to standalone/private/review-needed.
- Support redaction modes: none, standard, strict, and future custom rules.

## Definition Of Done

This feature is ready for real whole-life use when:

- The user can scan chosen computer roots and see organized candidates.
- The user can ingest selected files reliably from Chrome and the app browser.
- Every source becomes a standalone wiki source page first.
- Every source has a life domain, collection suggestion, privacy default, and review state.
- Neo4j writes are visible and queryable in a graph UI.
- The user can approve or reject graph relationships.
- The user can inspect and approve embedding chunks before Weaviate writes.
- Weaviate stores reviewed chunks with enough metadata for filtered hybrid search.
- The wiki index search can find pages, sources, topics, people, projects, services, and claims.
- The app clearly separates clients/cases from documents unless a reviewed attachment exists.
- The app clearly separates general-purpose personal/project/creative/admin records from case-management records.
- File cleanup is advisory until explicitly confirmed.
- Tests cover scanner, parser, graph writing, archive review, chunk review, and vector writes.

## Roadmap

### Phase 1: Stabilize The Current Wiki Spine

- Keep source-first ingest as the default.
- Finish archive review batch tools.
- Make wiki index search cover every page type.
- Add "Documents" as a first-class wiki index section separate from clients and cases.
- Keep expanding Life Domains as first-class wiki pages. Initial domain pages now appear in the index with source counts, review state, lanes, collections, source kinds, recent source links, domain review actions, graph/embedding readiness rollups, and a lightweight graph map.
- Make domain labels visible on source pages and archive review cards.
- Add clear badges for source docs vs client/case/service pages.
- Add more tests for batch review UI flows across multiple selected sources. Initial archive review route coverage now protects standalone, attachment, do-not-embed, canonical/superseded, and safe server-side batch actions.

### Phase 2: Whole-Life Import Campaign

- Add an import campaign manager with batches, progress, roots, lanes, and review status.
- Add domain review: Personal, Street Voices, Case Management, Projects, Creative, Research, Admin, Services, Partners, Unknown.
- Add content hashing and near-duplicate detection. Initial exact-hash and capped text-fingerprint duplicate detection are in place for local archive scans.
- Add better parsers: scanned PDF OCR, image OCR, Apple iWork, email archives, audio/video transcripts.
- Add a source preview pane with extracted text, parser warnings, table preview, and graph preview.
- Add explicit "do not ingest", "private archive only", and "review later" outcomes.

### Phase 3: Neo4j Graph Browser

- Add Case Wiki graph query API.
- Add graph visualization inside Case Management.
- Add filters for source type, privacy, review status, entity, date, lane, and relationship type. Initial source-page controls now filter edge status, relationship type, and review-decision diff status.
- Add graph drill-down from each wiki page.
- Add graph diff for before/after review decisions. Initial source-page graph diff cards now show candidate edge, review-decision node, and approved/rejected Neo4j relationship edge.

### Phase 4: Weaviate Embedding Review

- Add chunking service.
- Add chunk review UI.
- Add Weaviate schema/config.
- Add write path with idempotent upsert.
- Add embedding audit logs.
- Add filtered hybrid search UI.

### Phase 5: Wiki Synthesis

- Generate richer Wikipedia-style pages from reviewed sources.
- Add claim ledger, citations, backlinks, talk/review notes, and chronology.
- Add page merge/split flows.
- Add version history and superseded sources.
- Add "open brain" transparency panels that show source, extraction, inference, confidence, and review state.

### Phase 6: Cleanup And Life OS

- Add safe cleanup workflows for duplicate files, downloads, exports, screenshots, old versions, and large files.
- Add "keep", "archive", "move", "rename", and "delete" proposals with action-time confirmation.
- Add reversible cleanup logs.
- Add export of wiki pages, graph data, and vector metadata.

## Near-Term Build Queue

Next concrete tasks:

1. Add tests for archive batch review actions. Route-level coverage now protects standalone review, reviewed attachments, do-not-embed decisions, canonical/superseded decisions, and server-side batch review guardrails; next test pass should cover visual UI flow behavior.
2. Expand the Documents grouping into a fuller document library view. Document-type, source/attachment boundary, duplicate/canonical cleanup-status filters, saved views, saved custom views, sort modes, safe bulk actions, reviewer-owned work queues, collaboration-ready queue metadata, persisted queue history, teammate assignment, queue due dates, SLA aging, notification escalation rules, queue-level due-date filters, queue handoff comments, review throughput reporting, metadata-only JSON/CSV/Markdown queue export previews, reassignment alert preferences, notification delivery targets beyond the in-app workflow inbox, reviewer workload heatmaps, reviewer workload drill-downs, saved queue dashboards, dashboard sharing/duplication, queue dashboard access roles and role enforcement, owner capacity limits, queue capacity alerts inside the workflow notification inbox, capacity-alert acknowledgement/snooze, richer per-owner throughput history, owner-level throughput exports, queue health rules, import-size health templates, recurring digest snapshots, digest comparison, queue/owner export audit history, board-level action recommendations, recommendation acknowledgement/assignment/escalation/completion with due dates, internal recurring digest automation hooks with due-hook runner, metadata-only manager-board exports, internal manager-board sharing audit trails, teammate-grouped manager-board views, manager-board saved views, manager-board role enforcement, reviewer availability windows, backup owner coverage, owner-capacity/availability escalation rules, local digest auto-runner, and digest automation run ledger are in place; next pass should add a real server-side scheduler for digest hooks plus backend-owned role/audit records for dashboard mutations.
3. Expand Life Domains across the whole-life wiki. Local archive candidates, source pages, review filters, graph writes, wiki index/domain article pages, domain-level review actions, graph/embedding readiness rollups, visual graph filters, relationship examples, backend relationship decision writeback, source-page graph diff cards, source-page graph decision filters, batch review for pending filtered source-page graph edges, cross-source Life Domain relationship review, repeated-entity cluster grouping, and an initial source-to-entity node-link graph with native zoom, scroll pan, relationship labels, resilient URL-backed node inspection, selected-node source graph expansion, layout/depth controls, grouped import shelves, force-map layout, drag-to-pin graph editing, server-synced saved pinned graph workspaces, responsive narrow-pane behavior, graph search, server-backed graph search, graph presets, saved custom graph views, graph workspace sharing/duplication, graph workspace role enforcement, Neo4j-backed graph workspace nodes, graph workspace readback/audit browsing, restorable graph-workspace audit snapshots, side-by-side snapshot previews, rendered graph-slice audit metadata, interactive changed-node/edge focus controls, restore preview drawers, manager-facing graph workspace audit narratives, graph workspace audit approve/reject/revision notes, first-class Neo4j `GraphWorkspaceReview` nodes, workspace-history review summaries, version-trail review filters, graph-wide provenance search across loaded/all-domain workspaces, saved provenance search lenses, server-synced/shareable provenance lenses with first-class Neo4j `GraphProvenanceLens` nodes, manager-level lens permissions, lens activity history, first-class Neo4j `GraphProvenanceLensActivity` nodes, backend-owned permission enforcement for cross-user lens mutations, lens activity detail drawers, role-aware server readback filters for shared lenses, manager metadata-only activity exports for provenance lenses, persisted export audit records for provenance-lens downloads, a compact manager review queue for old lenses with missing activity history, manager-triggered backfill actions that create explicit `backfilled` activity records and write those activity-repair decisions to Neo4j, a batch backfill action for the visible manager repair queue, a repair ledger filtered by repaired activity type, metadata-only repair ledger exports with audit records, a native-vs-repaired activity trail graph lens, export audit filtering by export type, repaired activity edge drill-downs that open Neo4j node/relationship context, persisted repaired-edge inspection events, direct Cypher handoffs for selected repaired activity relationships, inspection-history filters on the activity trail lens, metadata-only repaired-edge inspection ledger exports, manager-facing inspection review summaries grouped by lens/repair/reviewer, reviewer-level inspection workload and escalation follow-ups, task creation for those follow-ups with manager assignment/audit history, server-persisted Case Wiki follow-up task assignment/completion state, a manager reconciliation view that compares follow-up tasks against the live repaired-edge workload, persisted reconciliation audit records for missing/stale follow-up decisions, and cluster drill-down links now carry life-domain context. Next pass should make those reconciliation audit records queryable from a dedicated manager history filter and Neo4j review node.
4. Add Embedding Review UI skeleton: chunk list, approval states, privacy badges, and "do not embed" option. Initial dry-run review data is now generated with each source; full chunk visibility, search/status filters, filtered batch review, per-chunk edit/redaction controls, and a reviewer-acknowledged live-write gate are now in place.
5. Add Weaviate config and service wrapper, initially dry-run only. Initial wrapper, UI dry-run preview, environment-gated batch write path, deterministic object ledger, confirmed delete path, visible UI rollback/reconcile panel, Neo4j `EmbeddingChunk`/`READY_FOR_INDEX`/`INDEXED_IN` graph writeback, a query-time retrieval workbench, a reviewed-citation answer-draft envelope, deterministic promotion preview, human-confirmed permanent-topic write path, promoted-page version history/rollback, explainable evidence ranking, a deterministic citation-constrained synthesis envelope, a promotion citation coverage diff, an inspectable model-writing packet, a disabled-by-default reviewed model-draft save path, a local model-draft adapter rehearsal, an external-adapter readiness preview, a saved external-adapter consent packet, a local external-request rehearsal guard, and a returned-citation output validator are now in place. Next step is explicit external adapter enablement with action-time source-transmission consent, secret/config selection, model/provider choice, real adapter response capture, and human-confirmed promotion of any adapter output.
6. Add graph query endpoint for a selected wiki page. Initial endpoint is now available at `/api/case-management/wiki/ingestions/:fileId/graph` with Neo4j query plus persisted graph fallback.
7. Add small graph browser panel on source pages. Initial source-page panel now shows graph nodes, edges, domain/review metadata, refresh, and neighboring source links.
8. Add local archive campaign state so scans/imports survive reloads as a named campaign. Initial campaign persistence, rename, history, resume batch, review queue handoff, saved checkpoint history, import lane board, client-side campaign lane command center, backend-saved schedule preview, run-next-step coordinator, backend-owned next-step runner, guarded cadence automation, saved-workspace server ticks, saved-workspace daemon queue preview, saved-workspace daemon pass, persistent daemon run ledger, disabled-by-default server interval hook, surfaced background-ingest progress, pause/resume/retry controls, a recent campaign job ledger, review-before-run controls, explicit selected-source confirmation, operator-facing dry-run/live-run environment visibility, daemon workflow handoff signals, controlled live-run rehearsal readiness checks, a reversible tiny rehearsal-batch overlay, and a watched launch checklist are now in place; next step is running one watched local/staging rehearsal only after the tiny overlay is confirmed and daemon execution is enabled for that session.
9. Add OCR/parser readiness report so the user knows which files need better extraction. Initial campaign-level readiness report is now visible for extractable files, PDFs, OCR-needed images/screenshots, transcript-needed media, metadata-only sources, and quarantined credential-like files.
10. Add source-page search across title, text preview, lane, collections, graph metadata, and parser notes. Initial source-aware index search is now in place, including match reasons and first-class document pages.
11. Add audit log entries for every review, attachment, embedding approval, and cleanup decision. Initial source-level archive, embedding, non-destructive cleanup, canonical/superseded-source decisions, article consolidation plans, article citation review packets, reviewed article draft previews, split-specific article reviews, promotion readiness checklists, and human-confirmed article promotions now persist and appear in the wiki page decision trail; local archive scans now add exact content hashes, capped text-fingerprint near-match groups, exact-hash source-history carry-forward for eligible files, durable canonical lineage for renamed/reformatted source-family matches, a source-page canonical group history panel with a metadata-only resolver for visible duplicate candidates, and an article merge-planning/citation-packet/draft-preview/split-review/readiness/promotion panel. Next step is the next picky whole-life ingestion pass using the lineage memory to avoid re-importing old copies.

## Developer Operating Rule

Before changing Case Management Wiki, ingestion, archive, graph, vector, or local-file features:

1. Read this file.
2. Check the relevant current code paths.
3. Keep changes scoped to Case Management unless an integration requires a small targeted edit elsewhere.
4. Preserve source-first organization.
5. Preserve human review before attachment and before embedding.
6. Update this file when the end goal, architecture, or roadmap changes.
