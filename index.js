/* ==========================================================================
   OPENAI PROOF TRACKER - INTERACTIVE LOGIC (VANILLA JS)
   Controls: Navigation, Table Rendering, Search, Code Modal, SVG highlight
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // --- Initialize State ---
  const steps = window.stepsData || [];
  let activeCategory = 'all';
  let searchQuery = '';

  // --- DOM Elements ---
  const ledgerTbody = document.getElementById('ledger-tbody');
  const searchInput = document.getElementById('search-input');
  const categoryFilter = document.getElementById('category-filter');
  
  // Modal Elements
  const codeModal = document.getElementById('code-modal');
  const modalStepNumber = document.getElementById('modal-step-number');
  const modalStepTitle = document.getElementById('modal-step-title');
  const modalMirror = document.getElementById('modal-mirror');
  const modalProblemId = document.getElementById('modal-problem-id');
  const modalEpisodeId = document.getElementById('modal-episode-id');
  const modalOutcome = document.getElementById('modal-outcome');
  const modalFilename = document.getElementById('modal-filename');
  const modalCode = document.getElementById('modal-code');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCopyCode = document.getElementById('btn-copy-code');

  // --- Category Classification Helper ---
  function getCategory(num) {
    if (num <= 12) return 'cubic';
    if (num >= 13 && num <= 16) return 'reductions';
    if (num >= 17 && num <= 20) return 'flow';
    if (num >= 21 && num <= 27) return 'packing';
    if (num >= 28 && num <= 34) return 'reductions';
    if (num >= 35 && num <= 39) return 'capstone';
    return 'cubic';
  }

  // --- Lean Code Highlighter ---
  function highlightLean(code) {
    if (!code) return '';
    let escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // 1. Comments
    escaped = escaped.replace(/(\/\-[\s\S]*?-\/)/g, '<span class="hl-comment">$1</span>');
    escaped = escaped.replace(/(^|[^\:])(\-\-[^\n]*)/g, '$1<span class="hl-comment">$2</span>');
    
    // 2. Strings
    escaped = escaped.replace(/("[^"\\]*(?:\\.[^"\\]*)*")/g, '<span class="hl-string">$1</span>');
    
    // 3. Keywords & Commands
    const keywords = ['theorem', 'lemma', 'def', 'abbrev', 'example', 'axiom', 'variable', 'set_option', 'noncomputable', 'section', 'namespace', 'end', 'import', 'open', 'universe'];
    const keywordRegex = new RegExp('\\b(' + keywords.join('|') + ')\\b', 'g');
    escaped = escaped.replace(keywordRegex, '<span class="hl-keyword">$1</span>');
    
    // 4. Tactics
    const tactics = ['intro', 'intros', 'have', 'let', 'set', 'exact', 'apply', 'refine', 'rw', 'rwa', 'simp', 'simp_all', 'simp_only', 'dsimp', 'congr', 'funext', 'by_cases', 'cases', 'induction', 'split', 'decide', 'native_decide', 'ring', 'norm_num', 'omega', 'aesop', 'by'];
    const tacticRegex = new RegExp('\\b(' + tactics.join('|') + ')\\b', 'g');
    escaped = escaped.replace(tacticRegex, '<span class="hl-command">$1</span>');
    
    // 5. Types
    const types = ['Prop', 'Type', 'ZMod', 'Fin', 'Finset', 'List', 'Fintype', 'DecidableEq', 'Decidable', 'Nat', 'Int'];
    const typeRegex = new RegExp('\\b(' + types.join('|') + ')\\b', 'g');
    escaped = escaped.replace(typeRegex, '<span class="hl-type">$1</span>');
    
    // 6. Symbols
    escaped = escaped.replace(/(\:\=|-&gt;|&lt;-&gt;|→|↔|∀|∃|λ|≃|∑|•)/g, '<span class="hl-symbol">$1</span>');
    
    return escaped;
  }

  // --- Render Table ---
  function renderLedger() {
    ledgerTbody.innerHTML = '';
    
    const filteredSteps = steps.filter(step => {
      const stepCat = getCategory(step.number);
      const matchesCat = activeCategory === 'all' || stepCat === activeCategory;
      
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        step.title.toLowerCase().includes(query) ||
        step.mirror.toLowerCase().includes(query) ||
        step.problemId.toLowerCase().includes(query) ||
        step.numberStr.includes(query);
        
      return matchesCat && matchesSearch;
    });

    if (filteredSteps.length === 0) {
      ledgerTbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 40px 20px;">
            No steps matched your search or category filter.
          </td>
        </tr>
      `;
      return;
    }

    filteredSteps.forEach(step => {
      const tr = document.createElement('tr');
      tr.className = 'ledger-row';
      tr.addEventListener('click', () => openModal(step));
      
      // Outcome formatting (Check warning for native_decide on Step 2)
      const isNativeDecide = step.outcome.includes('native_decide');
      const statusPill = isNativeDecide 
        ? `<span class="step-status-cell warning-status-cell">verified (native_decide)</span>`
        : `<span class="step-status-cell">kernel_verified</span>`;

      tr.innerHTML = `
        <td class="step-row-num">#${step.numberStr}</td>
        <td class="step-row-title">${step.title}</td>
        <td><span class="step-row-mirror">${step.mirror || 'N/A'}</span></td>
        <td class="step-row-uuid">${step.problemId}</td>
        <td>${statusPill}</td>
      `;
      
      ledgerTbody.appendChild(tr);
    });
  }

  // --- Search & Filter Listeners ---
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderLedger();
  });

  categoryFilter.addEventListener('change', (e) => {
    activeCategory = e.target.value;
    renderLedger();
  });

  // --- Modal Logic ---
  function openModal(step) {
    modalStepNumber.textContent = `Step ${step.numberStr}`;
    modalStepTitle.textContent = step.title;
    modalMirror.textContent = step.mirror || 'N/A';
    modalProblemId.textContent = step.problemId;
    modalEpisodeId.textContent = step.episodeId;
    modalOutcome.textContent = step.outcome;
    modalFilename.textContent = step.fileName || `${step.numberStr}-step.lean`;
    
    // Highlight & Render Code
    modalCode.innerHTML = highlightLean(step.code || '-- No Lean proof loaded.');
    
    codeModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    codeModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  btnCloseModal.addEventListener('click', closeModal);
  
  // Close modal when clicking backdrop
  codeModal.addEventListener('click', (e) => {
    if (e.target === codeModal) closeModal();
  });

  // Copy code to clipboard
  btnCopyCode.addEventListener('click', () => {
    const codeText = modalCode.textContent;
    navigator.clipboard.writeText(codeText).then(() => {
      const originalText = btnCopyCode.textContent;
      btnCopyCode.textContent = 'Copied!';
      btnCopyCode.style.borderColor = 'var(--green)';
      btnCopyCode.style.color = 'var(--green)';
      setTimeout(() => {
        btnCopyCode.textContent = originalText;
        btnCopyCode.style.borderColor = '';
        btnCopyCode.style.color = '';
      }, 2000);
    });
  });

  // Copy Problem or Episode IDs on click
  document.querySelectorAll('.copyable').forEach(el => {
    el.addEventListener('click', (e) => {
      const text = e.target.textContent;
      navigator.clipboard.writeText(text).then(() => {
        const originalBg = e.target.style.backgroundColor;
        e.target.style.backgroundColor = 'rgba(0, 255, 180, 0.1)';
        setTimeout(() => {
          e.target.style.backgroundColor = originalBg;
        }, 800);
      });
    });
  });

  // --- MCP Tools Showcase Data ---
  const mcpToolsData = {
    empirical_search: {
      desc: "Performs a stateful, iterative search to find valid proofs. Coordinates with the Lean compiler to verify candidates and branches based on diagnostic feedback.",
      params: `{
  "problem_id": "string (UUID v4 of the target Lean problem)",
  "strategies": "string[] (e.g. ['aesop', 'omega', 'induction'])",
  "max_depth": "integer (limiting search tree size)"
}`,
      example: `{
  "caller": "Gemini 3.5 Flash",
  "mcp_call": "proofsearch/empirical_search",
  "arguments": {
    "problem_id": "64ea8680-26c9-4544-acb3-eaf565df0e2e",
    "strategies": ["by_cases", "simp_all"]
  },
  "response": {
    "status": "kernel_verified",
    "attempts": 1,
    "proof": "intro x y t s hx hy hxy\\ndsimp\\nhave hz : x + y \\u2260 0 := by ...\\nby_cases h0 : s = t <;> simp_all"
  }
}`
    },
    draft: {
      desc: "Generates syntax-clean proof structures. Creates the skeletal structure containing helper lemmas, section scopes, and namespaces ready for compilation.",
      params: `{
  "problem_id": "string (UUID v4 of the target Lean problem)",
  "skeleton_outline": "string (High level roadmap or proof sketch)"
}`,
      example: `{
  "caller": "Gemini 3.5 Flash",
  "mcp_call": "proofsearch/draft",
  "arguments": {
    "problem_id": "78778b1d-1889-477e-a4ad-66eb22059045",
    "skeleton_outline": "Isolate ZMod 2 affine cardinality check from the core vertex parity indicator"
  },
  "response": {
    "draft_code": "theorem hcard : \\u2200 p h : Fin 3 \\u2192 ZMod 2, h \\u2260 0 \\u2192 (Finset.univ.filter ...).card = 2 := by decide\\n\\ntheorem cubic_even_double_cover : ...",
    "status": "draft_created"
  }
}`
    },
    formalization_plan: {
      desc: "Creates detailed, step-by-step mathematical proof plans, breaking a complex paper proof into specific lemmas checkable within Lean's constraints.",
      params: `{
  "manuscript_section": "string (e.g. 'Lemma 2.2')",
  "lean_definitions": "string (definitions of graphs or mappings already in scope)"
}`,
      example: `{
  "caller": "Gemini 3.5 Flash",
  "mcp_call": "proofsearch/formalization_plan",
  "arguments": {
    "manuscript_section": "Jaeger-Kilpatrick 8-Flow contraction step",
    "lean_definitions": "FiniteGraph, Bridgeless, contractEdge"
  },
  "response": {
    "plan_steps": [
      "Prove 2-cut conservation properties under contraction",
      "Isolate recursion base case for card V = 1",
      "Formulate strong induction on V cardinality"
    ]
  }
}`
    },
    reasoning_log: {
      desc: "Appends and tracks reasoning states, compiling failure logs and compiler diagnostics to trace the history of agent attempts.",
      params: `{
  "episode_id": "string (UUID v4)",
  "attempt_index": "integer",
  "log_entry": "string (Details on the compilation issue and fix approach)"
}`,
      example: `{
  "caller": "Gemini 3.5 Flash",
  "mcp_call": "proofsearch/reasoning_log",
  "arguments": {
    "episode_id": "e0395b03-697b-420b-a75e-39ef1e388882",
    "attempt_index": 3,
    "log_entry": "Discovered classical-instance poisoning of decide tactic. Explicitly scoped ZMod 2 equality to decidable before running decide."
  },
  "response": {
    "status": "logged"
  }
}`
    },
    lean_declaration_lookup: {
      desc: "Queries the local Lean project environment to fetch signatures and locations of user-defined declarations.",
      params: `{
  "query": "string (declaration name or fragment)"
}`,
      example: `{
  "caller": "Gemini 3.5 Flash",
  "mcp_call": "proofsearch/lean_declaration_lookup",
  "arguments": {
    "query": "compatibility_solvable"
  },
  "response": {
    "declarations": [
      {
        "name": "ProofSearch.compatibility_solvable",
        "type": "theorem",
        "signature": "root_theorem : \\u2200 f, ... \\u2192 compatibility_solvable f",
        "file": "steps/06-lemma-2-2-compatibility-solvable.lean"
      }
    ]
  }
}`
    },
    mathlib_search_declarations: {
      desc: "Searches Mathlib for library constants, theorems, and definitions that can be reused for the proof.",
      params: `{
  "query": "string (search terms)",
  "fuzzy": "boolean"
}`,
      example: `{
  "caller": "Gemini 3.5 Flash",
  "mcp_call": "proofsearch/mathlib_search_declarations",
  "arguments": {
    "query": "ZMod.univ_card"
  },
  "response": {
    "matches": [
      {
        "name": "ZMod.card",
        "signature": "card (n : \\u2115) : card (ZMod n) = n",
        "module": "Mathlib.Data.ZMod.Basic"
      }
    ]
  }
}`
    }
  };

  // --- MCP Tool Event Listeners ---
  const toolItems = document.querySelectorAll('.tool-item');
  const mcpConsoleTitle = document.getElementById('mcp-console-title');
  const mcpToolDescription = document.getElementById('mcp-tool-description');
  const mcpToolParams = document.getElementById('mcp-tool-params');
  const mcpToolExample = document.getElementById('mcp-tool-example');

  toolItems.forEach(item => {
    item.addEventListener('click', () => {
      // Toggle active class
      toolItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const toolKey = item.getAttribute('data-tool');
      const toolData = mcpToolsData[toolKey];
      
      if (toolData) {
        mcpConsoleTitle.textContent = `tool-spec: ${toolKey}`;
        mcpToolDescription.textContent = toolData.desc;
        mcpToolParams.textContent = toolData.params;
        mcpToolExample.textContent = toolData.example;
      }
    });
  });

  // --- Interactive Petersen Graph SVG & Cycles ---
  // Petersen Graph 6-cycle double cover mappings:
  // Pentagons vertices:
  // P1: 1-2-3-4-5-1 (Outer: o1, o2, o3, o4, o5)
  // P2: 6-8-10-5-1-6 (Spoke Pent 1: i1, i2, s5, o5, s1)
  // P3: 8-3-2-7-10-8 (Spoke Pent 2: s3, o2, s2, i3, i2)
  // P4: 10-7-9-4-5-10 (Spoke Pent 3: i3, i4, s4, o4, s5)
  // P5: 7-2-1-6-9-7 (Spoke Pent 4: s2, o1, s1, i5, i4)
  // P6: 9-6-8-3-4-9 (Spoke Pent 5: i5, i1, s3, o3, s4)
  const cycleEdges = {
    1: ['o1', 'o2', 'o3', 'o4', 'o5'],
    2: ['i1', 'i2', 's5', 'o5', 's1'],
    3: ['s3', 'o2', 's2', 'i3', 'i2'],
    4: ['i3', 'i4', 's4', 'o4', 's5'],
    5: ['s2', 'o1', 's1', 'i5', 'i4'],
    6: ['i5', 'i1', 's3', 'o3', 's4']
  };

  const cyclesLegendContainer = document.querySelector('.cycles-legend');
  // Re-build legend to feature all 6 cycles
  cyclesLegendContainer.innerHTML = `
    <span class="cycle-legend-pill c1" data-cycle="1">Cycle 1 (Outer Pentagon)</span>
    <span class="cycle-legend-pill c2" data-cycle="2">Cycle 2 (Spoke Pent A)</span>
    <span class="cycle-legend-pill c3" data-cycle="3">Cycle 3 (Spoke Pent B)</span>
    <span class="cycle-legend-pill c4" data-cycle="4">Cycle 4 (Spoke Pent C)</span>
    <span class="cycle-legend-pill c1" data-cycle="5">Cycle 5 (Spoke Pent D)</span>
    <span class="cycle-legend-pill c2" data-cycle="6">Cycle 6 (Spoke Pent E)</span>
  `;

  const legendPills = document.querySelectorAll('.cycle-legend-pill');
  const graphEdges = document.querySelectorAll('.graph-edge');

  legendPills.forEach(pill => {
    pill.addEventListener('mouseenter', () => {
      const cycleNum = pill.getAttribute('data-cycle');
      const activeEdges = cycleEdges[cycleNum];
      
      pill.classList.add('active');
      
      graphEdges.forEach(edge => {
        const edgeId = edge.getAttribute('data-edge');
        if (activeEdges.includes(edgeId)) {
          // Choose highlight color class
          if (cycleNum == 1 || cycleNum == 5) edge.classList.add('highlight-c1');
          else if (cycleNum == 2 || cycleNum == 6) edge.classList.add('highlight-c2');
          else if (cycleNum == 3) edge.classList.add('highlight-c3');
          else if (cycleNum == 4) edge.classList.add('highlight-c4');
        } else {
          edge.style.opacity = '0.15';
        }
      });
    });

    pill.addEventListener('mouseleave', () => {
      pill.classList.remove('active');
      graphEdges.forEach(edge => {
        edge.className.baseVal = 'graph-edge'; // Reset classes
        edge.style.opacity = '';
      });
    });
  });

  // --- Step 07 Attempt Monologue Walkthrough Data ---
  const attemptsData = {
    1: {
      title: "Attempt 1: Monologue & Action Log",
      observe: "The agent starts verification of problem 78778b1d-1889-477e-a4ad-66eb22059045. The theorem requires cubic labeling (composed of Lemmas 2.1 and 2.2).",
      orient: "The proof involves solving a system of linear equations in F₂³. Directly checking all 64 options using `decide` inside the main body might trigger high computation depth in Lean's evaluator.",
      decide: "Propose a unified theorem enclosing both ZMod 2 mapping and coordinate rearrangements. Run `episode_step` with the complete proof candidate.",
      act: "Submitted code to Lean compiler. Result: <code class='inline-code'>Compilation timed out (wall cap 60 seconds exceeded)</code>. Lean spent too much time trying to decide ZMod equations inline without helper lemma isolation."
    },
    2: {
      title: "Attempt 2: Decidable Tactic Analysis",
      observe: "Observe compilation timeout. Analyze imports and options. The verifier enforces a strict 60-second limit per session step.",
      orient: "The computation of the ZMod equations is decEq decidable, but the search space of combinations of ZMod 2 coordinates grows. The compiler needs specific `Decidable` instances registered in mathlib.",
      decide: "Add explicit `set_option` variables to force Lean evaluator parameters to avoid depth checking. Run `episode_step` again.",
      act: "Submitted modified code. Result: <code class='inline-code'>failed to synthesize Decidable (root_theorem ...)</code>. Lean could not construct the instance because the type parameters lacked explicit DecidableEq declarations."
    },
    3: {
      title: "Attempt 3: Resolving Instance Poisoning",
      observe: "Inspect decidable synthesis failure. The error traces to the choice of classical logic vs. decidable logic instances.",
      orient: "Importing `Classical` at the root of the file poisoned the `decide` tactic. The compiler switched to classical logic, making decidable structures non-computational.",
      decide: "Scope the classical sections. Explicitly isolate the decidable ZMod 2 evaluation inside helpers. Run `episode_step` with scoped modules.",
      act: "Submitted updated code. Result: <code class='inline-code'>typecheck error: classical logic instance interference</code>. The compiler still pulled global instances from mathlib dependencies."
    },
    4: {
      title: "Attempt 4: DecidableEq Coordinate Synthesis",
      observe: "Observe typecheck error. Find where the classical logic namespace gets opened.",
      orient: "Mathlib's characterization of ZMod 2 functions requires decidable coordinate loops. The coordinate system must be mapped to ZMod 2 and resolved.",
      decide: "Construct helper lemmas (`hldi`, `hft`, `hlpp`) that wrap the decidable checks and prove them separately using `decide`. This shields the main theorem from computation exhaustion.",
      act: "Submitted isolated helper proofs. Result: Helper proofs compiled instantly! But the final capstone glue failed because the types did not match exactly due to coordinate conversions."
    },
    5: {
      title: "Attempt 5: Budget Isolation Success",
      observe: "Analyze the type mismatch. The coordinates use `Fin 3` indices, which Lean's evaluator represents differently.",
      orient: "We must align helper lemma declarations with ZMod 2 vector structures exactly. Wrap variables in namespaces and isolate type conversions in a helper-budget module.",
      decide: "Adjust the ZMod equations in the helper theorems, write a clean coordinate mapper block, and compose them. Submit final candidate.",
      act: "Submitted. Result: <code class='inline-code'>kernel_verified</code>. The compilation succeeded in under 4 seconds! The modular isolation bypasses the 60-second cap."
    }
  };

  // --- Attempt Event Listeners ---
  const attemptNodes = document.querySelectorAll('.attempt-node');
  const attemptConsoleTitle = document.getElementById('attempt-console-title');
  const attemptObserve = document.getElementById('attempt-observe');
  const attemptOrient = document.getElementById('attempt-orient');
  const attemptDecide = document.getElementById('attempt-decide');
  const attemptAct = document.getElementById('attempt-act');

  attemptNodes.forEach(node => {
    node.addEventListener('click', () => {
      attemptNodes.forEach(n => n.classList.remove('active'));
      node.classList.add('active');

      const attemptNum = node.getAttribute('data-attempt');
      const data = attemptsData[attemptNum];

      if (data) {
        attemptConsoleTitle.textContent = data.title;
        attemptObserve.textContent = data.observe;
        attemptOrient.textContent = data.orient;
        attemptDecide.textContent = data.decide;
        // Check if there is code markup in act field
        attemptAct.innerHTML = data.act;
        
        // Update act tag color depending on outcome
        const actTag = document.querySelector('.tag-act');
        if (actTag) {
          if (attemptNum == 5) {
            actTag.textContent = 'VERIFY';
            actTag.className = 'log-tag tag-act-ok';
          } else {
            actTag.textContent = 'ACT';
            actTag.className = 'log-tag tag-act';
          }
        }
      }
    });
  });

  // --- Start App ---
  renderLedger();
});
