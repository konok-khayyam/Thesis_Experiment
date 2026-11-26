
const CFG = window.STUDY_CONFIG || {
  API_BASE_URL: "",
  DEMO_MODE: true,
  CHAT_PAGE: "chat.html"
};

const $ = s => document.querySelector(s);

const state = () =>
  JSON.parse(sessionStorage.getItem("study") || "{}");

const save = o =>
  sessionStorage.setItem(
    "study",
    JSON.stringify({ ...state(), ...o })
  );

const sid = () => {
  let s = state();

  if (!s.session_id) {
    s.session_id = "ST-" + (
      crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now()
    );
    save(s);
  }

  return s.session_id;
};

const esc = s =>
  String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

// Retrieve the Prolific participant ID from the URL.
const getProlificPid = () => {
  const params = new URLSearchParams(window.location.search);
  const pid =
    params.get("PROLIFIC_PID") ||
    state().prolific_pid ||
    "";

  if (pid) {
    save({ prolific_pid: pid });
  }

  return pid;
};

// All six study actions use the same n8n webhook.
async function post(action, data = {}) {
  if (CFG.DEMO_MODE) {
    return {
      demo: true,
      success: true,
      condition: "DEMO",
      chat_token: "",
      completion_code: "DEMO-CODE"
    };
  }

  if (!CFG.API_BASE_URL) {
    throw new Error("Backend URL is not configured.");
  }

  const response = await fetch(CFG.API_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action,
      ...data
    })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(
      result.message ||
      "Could not save your responses. Please try again."
    );
  }

  return result;
}

// HVIC baseline questionnaire: 16 items.
const HVIC = [
  [
    "I'd rather depend on myself than others.",
    "I rely on myself most of the time; I rarely rely on others.",
    "I often do “my own thing.”",
    "My personal identity, independent of others, is very important to me."
  ],
  [
    "It is important that I do my job better than others.",
    "Winning is everything.",
    "Competition is the law of nature.",
    "When another person does better than I do, I get tense and aroused."
  ],
  [
    "If a coworker gets a prize, I would feel proud.",
    "The well-being of my coworkers is important to me.",
    "To me, pleasure is spending time with others.",
    "I feel good when I cooperate with others."
  ],
  [
    "Parents and children must stay together as much as possible.",
    "It is my duty to take care of my family, even when I have to sacrifice what I want.",
    "Family members should stick together, no matter what sacrifices are required.",
    "It is important to me that I respect the decisions made by my groups."
  ]
].flat();

// Post-chat manipulation-check questionnaire: 12 items.
const POST = [
  [
    "The chatbot emphasized depending on oneself rather than on others.",
    "The chatbot emphasized doing things according to one's own preferences.",
    "The chatbot emphasized individual autonomy and independence."
  ],
  [
    "The chatbot emphasized achieving better results than other people.",
    "The chatbot emphasized winning and outperforming others.",
    "The chatbot emphasized competition between people."
  ],
  [
    "The chatbot emphasized cooperation with others.",
    "The chatbot emphasized the well-being of other people.",
    "The chatbot emphasized maintaining positive relationships and shared interests."
  ],
  [
    "The chatbot emphasized fulfilling one's obligations toward one's group or family.",
    "The chatbot emphasized making sacrifices for the benefit of the group.",
    "The chatbot emphasized respecting decisions established by one's group."
  ]
].flat();

// Four post-chat scenarios and their HVIC mappings.
const SC = [
  {
    id: "art",
    title: "Buying a piece of art",
    q: "You are buying a piece of art for your office. Which one factor is most important in deciding whether to buy it?",
    o: [
      ["A", "It is a good investment.", "VI"],
      ["B", "Your coworkers will like it.", "HC"],
      ["C", "You personally like it.", "HI"],
      ["D", "Your supervisor will approve of it.", "VC"]
    ]
  },
  {
    id: "self",
    title: "Describing Yourself",
    q: "Suppose you had to use one word to describe yourself. Which one would you use?",
    o: [
      ["A", "Unique.", "HI"],
      ["B", "Competitive.", "VI"],
      ["C", "Cooperative.", "HC"],
      ["D", "Dutiful.", "VC"]
    ]
  },
  {
    id: "happiness",
    title: "Happiness",
    q: "Happiness is attained by:",
    o: [
      ["A", "Gaining a lot of status in the community.", "VC"],
      ["B", "Having many friendly people around you.", "HC"],
      ["C", "Maintaining one's privacy.", "HI"],
      ["D", "Winning in competitions.", "VI"]
    ]
  },
  {
    id: "trip",
    title: "Major Trip",
    q: "You are planning to take a major trip that is likely to inconvenience many people at your place of work during your absence. With whom would you discuss it before deciding whether or not to take it?",
    o: [
      ["A", "No one.", "HI"],
      ["B", "Your parents.", "VC"],
      ["C", "Your spouse or close friend.", "HC"],
      ["D", "Experts familiar with the place you plan to travel to.", "VI"]
    ]
  }
];

// Render a nine-point Likert scale.
function scale(text, i, lo, hi) {
  return `
    <article class="item-card">
      <p class="item-text">${i + 1}. ${esc(text)}</p>
      <div class="scale-labels">
        <span>${lo}</span>
        <span>${hi}</span>
      </div>
      <div class="likert">
        ${Array.from({ length: 9 }, (_, n) => `
          <label>
            <input
              type="radio"
              name="i${i}"
              value="${n + 1}"
              required
            >
            <span>${n + 1}</span>
          </label>
        `).join("")}
      </div>
    </article>
  `;
}

// PAGE 1: Consent.

function initConsent() {
  const form = $("#consent-form");

  if (!form) return;

  form.addEventListener("submit", async e => {
    e.preventDefault();

    // Browser validates that all required checkboxes are selected.
    if (!form.reportValidity()) return;

    try {
      // Send only "Yes" as the consent value.
      await post("consent", {
        session_id: sid(),
        prolific_pid: getProlificPid(),
        consent: "Yes"
      });

      save({
        consent: "Yes",
        consented: true
      });

      location.href = "demographics.html";

    } catch (error) {
      const errorElement = $("#consent-error");

      if (errorElement) {
        errorElement.textContent = error.message;
      }
    }
  });
}

// PAGE 2: Demographics and baseline HVIC.
function initBaseline() {
  const h = $("#hvic-items");
  if (!h) return;

  h.innerHTML = HVIC.map((x, i) =>
    scale(
      x,
      i,
      "1 = Never / Definitely No",
      "9 = Always / Definitely Yes"
    )
  ).join("");

  $("#baseline-form").addEventListener("submit", async e => {
    e.preventDefault();

    const f = e.currentTarget;
    if (!f.reportValidity()) return;

    const demographics = Object.fromEntries(
      new FormData(f)
    );

    const hvic = {};

    for (let i = 0; i < 16; i++) {
      hvic[i + 1] = Number(
        $(`input[name="i${i}"]:checked`)?.value
      );
    }

    try {
      // Save demographics and baseline responses.
      await post("baseline", {
        session_id: sid(),
        demographics,
        hvic
      });

      save({
        demographics,
        hvic,
        baseline: true
      });

      // Request the participant's experimental condition.
      const a = await post("assign", {
        session_id: sid()
      });

      if (!a.condition) {
        throw new Error(
          "The experimental condition was not returned by the backend."
        );
      }

      // Save the assigned condition and chat token.
      save({
        condition: a.condition,
        chat_token: a.chat_token || ""
      });

      // Redirect to the existing chatbot page.
      const u = new URL(CFG.CHAT_PAGE, location.href);

      u.searchParams.set("session_id", sid());

      u.searchParams.set(
        "return_url",
        new URL("post-chat.html", location.href).href
      );

      if (a.chat_token) {
        u.searchParams.set("chat_token", a.chat_token);
      }

      location.href = u.href;

    } catch (x) {
      $("#baseline-error").textContent = x.message;
    }
  });
}

// PAGE 4: Post-chat questionnaire.
function initPost() {
  const h = $("#postchat-items");
  if (!h) return;

  h.innerHTML = POST.map((x, i) =>
    scale(
      x,
      i,
      "1 = Strongly disagree",
      "9 = Strongly agree"
    )
  ).join("");

  $("#postchat-form").addEventListener("submit", async e => {
    e.preventDefault();

    const responses = {};

    for (let i = 0; i < 12; i++) {
      responses[i + 1] = Number(
        $(`input[name="i${i}"]:checked`)?.value
      );
    }

    if (Object.values(responses).some(Number.isNaN)) {
      $("#postchat-error").textContent =
        "Please answer all 12 statements.";
      return;
    }

    try {
      await post("postchat", {
        session_id: sid(),
        responses
      });

      save({ postchat: responses });

      location.href = "scenarios.html";

    } catch (x) {
      $("#postchat-error").textContent = x.message;
    }
  });
}

// PAGE 5: Four scenario choices.
function initScenarios() {
  const h = $("#scenario-items");
  if (!h) return;

  h.innerHTML = SC.map((s, i) => `
    <article class="scenario-card">
      <span class="scenario-number">
        SCENARIO ${i + 1} OF 4
      </span>

      <h2>${esc(s.title)}</h2>
      <p>${esc(s.q)}</p>

      ${s.o.map(o => `
        <label class="scenario-option">
          <input
            type="radio"
            name="${s.id}"
            value="${o[0]}"
            required
          >
          <span>
            <b>${o[0]}.</b> ${esc(o[1])}
          </span>
        </label>
      `).join("")}
    </article>
  `).join("");

  $("#scenarios-form").addEventListener("submit", async e => {
    e.preventDefault();

    const answers = {};

    for (const s of SC) {
      const v = $(`input[name="${s.id}"]:checked`);

      if (!v) {
        $("#scenarios-error").textContent =
          "Please answer every scenario.";
        return;
      }

      answers[s.id] = {
        option: v.value,
        code: s.o.find(o => o[0] === v.value)[2]
      };
    }

    try {
      await post("scenarios", {
        session_id: sid(),
        answers
      });

      save({ scenarios: answers });

      location.href = "debrief.html";

    } catch (x) {
      $("#scenarios-error").textContent = x.message;
    }
  });
}

// PAGE 6: Study completion.
function initDebrief() {
  $("#finish-button")?.addEventListener("click", async () => {
    try {
      const r = await post("complete", {
        session_id: sid()
      });

      $("#completion-code").textContent =
        r.completion_code ||
        (CFG.DEMO_MODE
          ? "DEMO-" + sid().slice(-8)
          : "Completion recorded");

      $("#finish-button").disabled = true;
      $("#finish-button").textContent = "Study completed";

    } catch (x) {
      alert(x.message);
    }
  });
}

// Initialize the correct page.
document.addEventListener("DOMContentLoaded", () => {
  const p = document.body.dataset.page;

  if (p === "consent") initConsent();
  if (p === "baseline") initBaseline();
  if (p === "postchat") initPost();
  if (p === "scenarios") initScenarios();
  if (p === "debrief") initDebrief();
});
