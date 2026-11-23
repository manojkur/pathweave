const svgNS = "http://www.w3.org/2000/svg";
function svg(tag, attrs = {}, text) {
  const n = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}
const base = () =>
  svg("svg", {
    viewBox: "0 0 600 350",
    role: "img",
    "aria-label":
      "Interactive mathematical illustration. The explanation below describes its meaning.",
  });
function line(root, x1, y1, x2, y2, color = "#52776b", width = 1) {
  root.append(
    svg("line", { x1, y1, x2, y2, stroke: color, "stroke-width": width }),
  );
}
function text(root, x, y, value) {
  root.append(svg("text", { x, y, class: "svg-text" }, value));
}
function path(root, points, color = "#b5d598", width = 3) {
  root.append(
    svg("path", {
      d: points.map((p, i) => (i ? "L" : "M") + p.join(",")).join(" "),
      fill: "none",
      stroke: color,
      "stroke-width": width,
      "stroke-linejoin": "round",
    }),
  );
}
function axes(root) {
  for (let x = 60; x < 580; x += 50) line(root, x, 25, x, 315, "#23474a");
  for (let y = 40; y < 330; y += 40) line(root, 45, y, 580, y, "#23474a");
  line(root, 55, 285, 580, 285, "#65877b");
  line(root, 80, 25, 80, 320, "#65877b");
}
function control(panel, label, min, max, step, value, update) {
  const box = document.createElement("div"),
    l = document.createElement("label"),
    i = document.createElement("input");
  i.type = "range";
  i.min = min;
  i.max = max;
  i.step = step;
  i.value = value;
  i.setAttribute("aria-label", label);
  l.textContent = label + ": " + value;
  box.append(l, i);
  panel.append(box);
  i.oninput = () => {
    l.textContent = label + ": " + i.value;
    update(Number(i.value));
  };
  return i;
}
const narratives = {
  ode: [
    "Start with a local rule: at every point, the slope is k times the current amount. The short strokes show those local slopes.",
    "Change k or the starting amount. The green curve follows the rule continuously; the gold steps follow a numerical approximation.",
    "The exact solution is x(t)=x₀ exp(kt). Differentiation checks the rule. Multiplying any solution by exp(−kt) proves uniqueness.",
    "What changes for a vector state x′=Ax? Invariant directions reduce the motion to exponential modes. Existence and uniqueness need assumptions for nonlinear rules.",
  ],
  "linear-map": [
    "The faint grid is the original coordinate system. The bright grid shows a linear transformation acting on it.",
    "Move the transformation slider. The basis arrows move, and every grid point follows from its coordinates.",
    "T(au+bv)=aT(u)+bT(v). The columns of a matrix are the transformed basis vectors.",
    "A derivative is also a linear map: it approximates how a nonlinear function acts near one point.",
  ],
  convergence: [
    "The dots are the terms 1/n. Each gets closer to zero, but a picture alone does not establish convergence.",
    "Tighten ε. The shaded strip is the requested tolerance around zero. Later terms must stay inside it.",
    "Given ε>0, choose N>1/ε. Every n>N then satisfies |1/n−0|<ε.",
    "Try a new sequence, or change the surrounding number system. Convergence depends on both the rule and the space.",
  ],
  derivative: [
    "The green curve is x². Two nearby points determine a gold secant line.",
    "Move the point or reduce the gap h. Watch the secant slope approach the slope of the mint tangent.",
    "The quotient ((a+h)²−a²)/h equals 2a+h for h≠0, hence its limit is 2a.",
    "For a corner, the two one-sided slopes disagree. In higher dimensions, the tangent approximation becomes a linear transformation.",
  ],
  fractions: [
    "A bar is one whole. The shaded pieces describe a fraction of that whole.",
    "Change how many equal pieces are shaded. Count both the shaded pieces and all the pieces.",
    "Equivalent fractions describe the same ratio. Multiply or divide both numerator and denominator by the same nonzero number.",
    "The same part-to-whole relation describes probabilities in a finite uniform sample space.",
  ],
  probability: [
    "Blue and gold counters form an explicit sample space. The blue proportion determines the theoretical probability.",
    "Change the number of blue counters, then draw a sample. The observed frequency can differ from the theoretical value.",
    "P(blue)=number of blue counters / number of all equally likely counters. State the equal-likelihood assumption.",
    "Larger samples can stabilize frequencies, but probability models must justify their weights. Two named outcomes are not automatically equally likely.",
  ],
  quantifiers: [
    "For each input x, a witness y may be chosen. The order of those choices matters.",
    "Move x. The witness y=x+1 moves too; it need not be the same witness for every x.",
    "∀x∈ℝ ∃y∈ℝ: y>x. Negating the claim gives ∃x∈ℝ ∀y∈ℝ: y≤x.",
    "Convergence and uniform convergence differ in whether one choice must work for all inputs. Keep track of which earlier choices a witness may depend on.",
  ],
};
export function mountScene(container, type = "ode", custom) {
  container.replaceChildren();
  const scene = document.createElement("div");
  scene.className = "scene";
  const root = base(),
    panel = document.createElement("div");
  panel.className = "scene-controls";
  scene.append(root, panel);
  const beats = document.createElement("div");
  beats.className = "beats";
  const narration = document.createElement("div");
  narration.className = "narration";
  narration.setAttribute("aria-live", "polite");
  const story = custom || narratives[type] || narratives["linear-map"];
  let beat = 0;
  for (const [label, i] of [
    "Observe",
    "Explore",
    "Make it precise",
    "Connect",
  ].map((x, i) => [x, i])) {
    const b = document.createElement("button");
    b.textContent = i + 1 + ". " + label;
    b.onclick = () => {
      beat = i;
      showBeat();
    };
    beats.append(b);
  }
  function showBeat() {
    [...beats.children].forEach((b, i) => {
      b.classList.toggle("active", i === beat);
      b.setAttribute("aria-pressed", String(i === beat));
    });
    narration.textContent = story[beat];
  }
  showBeat();
  container.append(scene, beats, narration);
  if (type === "ode") {
    let k = 0.6,
      x0 = 1,
      h = 0.5;
    const draw = () => {
      root.replaceChildren();
      axes(root);
      const X = (t) => 80 + t * 95,
        Y = (x) => 285 - x * 43;
      for (let t = 0; t <= 5; t += 0.4)
        for (let x = 0; x <= 5.8; x += 0.6) {
          let dx = 10,
            dy = ((-k * x * 43) / 95) * dx;
          const scale = 9 / Math.hypot(dx, dy);
          line(
            root,
            X(t) - dx * scale,
            Y(x) - dy * scale,
            X(t) + dx * scale,
            Y(x) + dy * scale,
            "#557267",
          );
        }
      const exact = [];
      for (let t = 0; t <= 5; t += 0.025) {
        const y = Y(x0 * Math.exp(k * t));
        if (y >= 25 && y <= 315) exact.push([X(t), y]);
      }
      path(root, exact);
      let x = x0;
      const pts = [[X(0), Y(x)]];
      for (let t = h; t <= 5 + 0.001; t += h) {
        x += h * k * x;
        if (Y(x) < 25 || Y(x) > 315) break;
        pts.push([X(t), Y(x)]);
      }
      path(root, pts, "#dcac68", 2);
      root.append(
        svg("circle", { cx: X(0), cy: Y(x0), r: 5, fill: "#d6e6b8" }),
      );
      text(root, 410, 335, "time →");
      text(root, 100, 30, "amount x");
      text(root, 320, 30, "x′ = " + k.toFixed(1) + "x");
    };
    control(panel, "Growth rate k", -1, 1.5, 0.1, k, (v) => {
      k = v;
      draw();
    });
    control(panel, "Initial amount", 0.5, 3, 0.25, x0, (v) => {
      x0 = v;
      draw();
    });
    control(panel, "Euler step h", 0.1, 1, 0.1, h, (v) => {
      h = v;
      draw();
    });
    draw();
  } else if (type === "derivative") {
    let a = 1.2,
      h = 0.8;
    const draw = () => {
      root.replaceChildren();
      axes(root);
      const X = (x) => 80 + x * 110,
        Y = (y) => 285 - y * 36;
      const pts = [];
      for (let x = 0; x < 3.5; x += 0.03) pts.push([X(x), Y(x * x)]);
      path(root, pts);
      const m = 2 * a + h;
      line(
        root,
        X(a - 0.8),
        Y(a * a - m * 0.8),
        X(a + 1),
        Y(a * a + m),
        "#dcae72",
        2,
      );
      line(
        root,
        X(a - 0.8),
        Y(a * a - 2 * a * 0.8),
        X(a + 1),
        Y(a * a + 2 * a),
        "#81c8bc",
        2,
      );
      for (const x of [a, a + h])
        root.append(
          svg("circle", { cx: X(x), cy: Y(x * x), r: 5, fill: "#dcac68" }),
        );
      text(root, 320, 35, "secant slope: " + m.toFixed(2));
      text(root, 320, 56, "tangent slope: " + (2 * a).toFixed(2));
    };
    control(panel, "Point a", 0.2, 2, 0.1, a, (v) => {
      a = v;
      draw();
    });
    control(panel, "Gap h", 0.02, 1, 0.02, h, (v) => {
      h = v;
      draw();
    });
    draw();
  } else if (type === "convergence") {
    let e = 0.2;
    const draw = () => {
      root.replaceChildren();
      const X = (n) => 75 + n * 15,
        Y = (y) => 280 - y * 210;
      root.append(
        svg("rect", {
          x: 65,
          y: Y(e),
          width: 500,
          height: 210 * e,
          fill: "#5b946a",
          opacity: 0.24,
        }),
      );
      line(root, 65, Y(0), 570, Y(0));
      line(root, 65, Y(e), 570, Y(e), "#c4ad73");
      for (let n = 1; n <= 32; n++)
        root.append(
          svg("circle", {
            cx: X(n),
            cy: Y(1 / n),
            r: 4,
            fill: 1 / n < e ? "#b8d89b" : "#d8a05d",
          }),
        );
      text(root, 310, 48, "ε = " + e.toFixed(2));
      text(root, 310, 70, "N > 1/ε = " + (1 / e).toFixed(1));
      text(root, 460, 315, "index n →");
    };
    control(panel, "Tolerance ε", 0.04, 0.8, 0.02, e, (v) => {
      e = v;
      draw();
    });
    draw();
  } else if (type === "fractions" || type === "probability") {
    let a = 2,
      draws = 0,
      blue = 0;
    const draw = () => {
      root.replaceChildren();
      text(
        root,
        65,
        70,
        type === "fractions"
          ? "One whole, partitioned equally"
          : "A finite uniform sample space",
      );
      for (let i = 0; i < 8; i++) {
        root.append(
          svg("rect", {
            x: 65 + i * 58,
            y: 115,
            width: 53,
            height: 90,
            rx: 4,
            fill: i < a ? "#9bbfa5" : "#c8aa76",
          }),
        );
        text(root, 84 + i * 58, 235, String(i + 1));
      }
      text(
        root,
        75,
        285,
        type === "fractions"
          ? a + "/8 of the whole"
          : "P(blue) = " +
              a +
              "/8" +
              (draws ? " · observed " + blue + "/" + draws : ""),
      );
    };
    control(panel, "Shaded / blue counters", 1, 7, 1, a, (v) => {
      a = v;
      draws = 0;
      blue = 0;
      draw();
    });
    if (type === "probability") {
      const b = document.createElement("button");
      b.textContent = "Draw 40 counters (with replacement)";
      b.onclick = () => {
        const bytes = new Uint8Array(40);
        crypto.getRandomValues(bytes);
        for (const x of bytes) {
          draws++;
          if (x % 8 < a) blue++;
        }
        draw();
      };
      panel.append(b);
    }
    draw();
  } else if (type === "quantifiers") {
    let x = 2;
    const draw = () => {
      root.replaceChildren();
      line(root, 60, 190, 550, 190);
      for (let i = -3; i <= 7; i++) {
        line(root, 230 + i * 40, 185, 230 + i * 40, 195);
        text(root, 224 + i * 40, 218, String(i));
      }
      root.append(
        svg("circle", { cx: 230 + x * 40, cy: 190, r: 8, fill: "#92c6b1" }),
        svg("circle", {
          cx: 230 + (x + 1) * 40,
          cy: 190,
          r: 8,
          fill: "#d6ad71",
        }),
      );
      text(root, 80, 80, "For any x, choose y = x + 1.");
      text(root, 80, 285, "x = " + x + "   →   y = " + (x + 1) + " > " + x);
    };
    control(panel, "Input x", -3, 6, 1, x, (v) => {
      x = v;
      draw();
    });
    draw();
  } else {
    let t = 0.7;
    const draw = () => {
      root.replaceChildren();
      const X = (x, y, tx) => 300 + 48 * ((1 + tx) * x + tx * y),
        Y = (x, y) => 175 - 48 * y;
      for (let i = -3; i <= 3; i++) {
        line(root, X(i, -3, 0), Y(i, -3), X(i, 3, 0), Y(i, 3), "#29494a");
        line(root, X(-3, i, 0), Y(-3, i), X(3, i, 0), Y(3, i), "#29494a");
        line(root, X(i, -3, t), Y(i, -3), X(i, 3, t), Y(i, 3), "#628a71");
        line(root, X(-3, i, t), Y(-3, i), X(3, i, t), Y(3, i), "#628a71");
      }
      line(root, 300, 175, X(1, 0, t), Y(1, 0), "#c7d99d", 4);
      line(root, 300, 175, X(0, 1, t), Y(0, 1), "#d2a770", 4);
      text(root, 30, 32, "T(x,y) = ((1+s)x + sy, y)");
      text(
        root,
        30,
        320,
        "s = " +
          t.toFixed(2) +
          " · basis arrows determine the entire transformation",
      );
    };
    control(panel, "Transformation s", 0, 1, 0.02, t, (v) => {
      t = v;
      draw();
    });
    draw();
  }
  return {
    setBeat: (i) => {
      beat = i;
      showBeat();
    },
  };
}
export function heroGraphic() {
  const root = svg("svg", {
    viewBox: "0 0 350 260",
    role: "img",
    "aria-label": "Several learning paths weave toward a shared idea",
  });
  for (let i = 0; i < 5; i++) {
    const d = `M 10 ${210 - i * 32} C 100 ${240 - i * 48}, 110 ${20 + i * 32}, 190 ${70 + i * 23} S 270 ${210 - i * 18}, 340 ${50 + i * 27}`;
    root.append(
      svg("path", {
        d,
        fill: "none",
        stroke: ["#6c956e", "#a4b28a", "#c4b085", "#456f61", "#8faba0"][i],
        "stroke-width": i === 0 ? 3 : 1.5,
      }),
    );
  }
  for (const [x, y, r] of [
    [66, 174, 5],
    [143, 91, 5],
    [223, 115, 7],
    [289, 104, 5],
    [183, 141, 4],
  ]) {
    root.append(
      svg("circle", { cx: x, cy: y, r: r + 5, fill: "#e9efe5" }),
      svg("circle", { cx: x, cy: y, r, fill: "#6f956b" }),
    );
  }
  text(root, 170, 228, "Different paths. Deeper connections.");
  return root;
}
