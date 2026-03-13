const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.MODELSTUDIO_API_KEY,
  baseURL: process.env.MODELSTUDIO_BASE_URL,
});

const PRIMARY_MODEL = process.env.MODELSTUDIO_MODEL || "qwen3-coder-plus";

// Fallback chain: try primary → fallback models in order
const MODEL_CHAIN = [
  PRIMARY_MODEL,
  "qwen3-plus",
  "qwen3-coder",
  "qwen-plus",
];

/**
 * Evaluates a Python solution using Qwen3-Coder-Plus via ModelStudio.
 * 
 * Key design:
 * - Anti-spoiler: suggestions never reveal the solution method
 * - Format-flexible: accepts any correct algorithm regardless of print format
 * - Model fallback: tries multiple models if primary fails (rate limit, tokens, etc.)
 * 
 * @param {Object} params
 * @param {string} params.code - Student's Python code
 * @param {Object} params.problem - Problem object from DB
 * @returns {Object} Evaluation result
 */
async function evaluatePythonSolution({ code, problem }) {
  const maxPts = problem.points;

  const systemPrompt = `Eres un evaluador experto de código Python para concursos académicos.
Tu evaluación debe ser JUSTA e INTELIGENTE. Debes comprender la INTENCIÓN del código, no solo la forma.

REGLAS DE FORMATO (MUY IMPORTANTE):
- Si un estudiante usa print() con texto adicional (como "El resultado es: 42" en lugar de solo "42"),
  pero el valor correcto está presente en la salida, DEBES aceptar la solución como correcta.
- Lo mismo aplica para variaciones de formato: espacios extra, newlines, mayúsculas/minúsculas en texto fijo.
- Acepta: variables con nombres distintos, uso de f-strings vs concatenación,
  bucles for vs while, recursión vs iteración, list comprehension vs bucle, etc.
- El foco PRINCIPAL es: ¿El algoritmo resuelve el problema correctamente?

REGLAS ANTI-SPOILER (OBLIGATORIAS):
- NUNCA reveles la solución completa ni el algoritmo específico necesario en el feedback.
- NUNCA muestres fragmentos de código corregido ni de la solución correcta.
- NUNCA menciones el nombre de algoritmos o estructuras de datos que revelen HOW se resuelve.
- Las sugerencias deben ser GENÉRICAS y ORIENTADORAS, por ejemplo:
  "Revisa cómo lees la entrada", "Considera los casos borde", "Verifica tu lógica de iteración".
- NO digas cosas como "Deberías usar un diccionario" o "La solución requiere ordenar el array".

Responde SIEMPRE con JSON puro, sin markdown, sin texto adicional.`;

  const userPrompt = `## PROBLEMA
Título: ${problem.title}
Enunciado: ${problem.statement.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}
Ejemplo de entrada: ${problem.exampleIn || "(sin ejemplo)"}
Salida esperada: ${problem.exampleOut || "(sin ejemplo)"}
Notas especiales: ${problem.aiNotes || "Ninguna"}
Puntos máximos: ${maxPts}

## SOLUCIÓN DEL ESTUDIANTE
\`\`\`python
${code}
\`\`\`

## INSTRUCCIONES DE EVALUACIÓN
Evalúa con estos criterios:

1. **Corrección lógica** (0-${Math.round(maxPts * 0.55)} pts): ¿El algoritmo resuelve el problema correctamente?
   - Acepta CUALQUIER enfoque algorítmico válido (iterativo, recursivo, matemático, etc.)
   - Si el algoritmo es correcto pero la implementación tiene un bug menor, da crédito parcial alto
2. **Output correcto** (0-${Math.round(maxPts * 0.25)} pts): ¿Produce la salida esperada? 
   - ACEPTA si el valor correcto aparece aunque haya texto adicional (ej: "Resultado: 42" cuando se espera "42")
   - ACEPTA variaciones de formato menores (espacios, newlines, mayúsculas, f-strings, concatenación)
   - RECHAZA solo si el valor numérico/lógico es incorrecto
3. **Uso correcto de input()** (0-${Math.round(maxPts * 0.10)} pts): ¿Lee la entrada correctamente?
4. **Calidad del código** (0-${Math.round(maxPts * 0.07)} pts): Legibilidad, nombres de variables, estructura
5. **Bonus eficiencia** (0-${Math.round(maxPts * 0.03)} pts): Complejidad óptima, no redundancias

PENALIZACIONES:
- Error de sintaxis (SyntaxError): -${Math.round(maxPts * 0.4)} pts
- Uso de librerías no estándar sin justificación: -${Math.round(maxPts * 0.1)} pts

## FORMATO DE RESPUESTA (JSON estricto)
{
  "passed": <true si score >= 70% del máximo>,
  "verdict": "Accepted" | "Partial Credit" | "Wrong Answer" | "Syntax Error",
  "score": <número entero entre 0 y ${maxPts}>,
  "scoreBreakdown": {
    "logicScore": <0-${Math.round(maxPts * 0.55)}>,
    "outputScore": <0-${Math.round(maxPts * 0.25)}>,
    "inputScore": <0-${Math.round(maxPts * 0.10)}>,
    "qualityScore": <0-${Math.round(maxPts * 0.07)}>,
    "bonusScore": <0-${Math.round(maxPts * 0.03)}>
  },
  "feedback": "<2-4 oraciones en español sobre qué hizo bien y qué puede mejorar. SIN revelar la solución>",
  "outputAnalysis": "<explica por qué aceptas o rechazas el formato de salida>",
  "suggestions": "<1-2 sugerencias genéricas y constructivas en español. NUNCA reveles el método de solución>",
  "detectedIssues": ["<lista de problemas encontrados, puede estar vacía>"]
}`;

  // Try each model in the fallback chain
  for (let modelIdx = 0; modelIdx < MODEL_CHAIN.length; modelIdx++) {
    const model = MODEL_CHAIN[modelIdx];
    let attempts = 0;
    const MAX_ATTEMPTS = 2;

    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      try {
        const response = await client.chat.completions.create({
          model,
          max_tokens: 1200,
          temperature: 0.05,  // Lower temperature for more deterministic results
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });

        const raw = response.choices[0]?.message?.content?.trim() || "";

        // Strip possible markdown code fences and thinking tags
        let cleaned = raw
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/```\s*$/, "")
          .replace(/<think>[\s\S]*?<\/think>/gi, "")
          .trim();

        // Extract JSON object
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in AI response");

        const parsed = JSON.parse(jsonMatch[0]);

        // Validate and sanitize
        const score = Math.max(0, Math.min(parseInt(parsed.score) || 0, maxPts));
        return {
          passed: Boolean(parsed.passed),
          verdict: parsed.verdict || "Wrong Answer",
          score,
          scoreBreakdown: parsed.scoreBreakdown || {},
          feedback: parsed.feedback || "Sin feedback disponible.",
          outputAnalysis: parsed.outputAnalysis || "",
          suggestions: parsed.suggestions || "",
          detectedIssues: Array.isArray(parsed.detectedIssues) ? parsed.detectedIssues : [],
          model,
        };
      } catch (err) {
        console.error(`[AI] Model ${model}, attempt ${attempts} failed:`, err.message);
        
        // Check if it's a rate limit or quota error — skip remaining attempts for this model
        const isQuotaError = err.status === 429 || err.status === 402 ||
          (err.message && (err.message.includes("quota") || err.message.includes("rate") || err.message.includes("limit")));
        
        if (isQuotaError) {
          console.warn(`[AI] Quota/rate limit hit for model ${model}, trying next model...`);
          break; // Skip to next model in chain
        }

        if (attempts >= MAX_ATTEMPTS) {
          // Move to next model
          console.warn(`[AI] All attempts exhausted for ${model}, trying next model...`);
          break;
        }
        // Wait before retry (exponential backoff)
        await new Promise(r => setTimeout(r, 2000 * attempts));
      }
    }
  }

  // All models failed — return graceful error
  console.error("[AI] All models in fallback chain failed");
  return {
    passed: false,
    verdict: "Pending",
    score: 0,
    scoreBreakdown: {},
    feedback: "El servicio de evaluación no está disponible temporalmente. Inténtalo de nuevo.",
    outputAnalysis: "",
    suggestions: "",
    detectedIssues: ["Error de conexión con el servicio de IA"],
    model: "none",
    error: "All models failed",
  };
}

module.exports = { evaluatePythonSolution };
