async function main() {
  let input: any = {};
  try {
    const text = await Bun.stdin.text();
    if (text.trim()) {
      input = JSON.parse(text);
    }
  } catch {
    // Ignore parse errors on empty stdin
  }

  const command = (input.toolCall?.args?.CommandLine || '').trim();

  // Guard 1: Block raw git push --force without --force-with-lease
  if (/\bgit\s+push\b.*(-f\b|--force\b)(?!-with-lease)/.test(command)) {
    console.log(
      JSON.stringify({
        decision: 'deny',
        reason:
          'Safety Gate: Raw --force push blocked. Use --force-with-lease instead to prevent overwriting remote work.',
      }),
    );
    process.exit(0);
  }

  // Guard 2: Block direct edits to packs/behavior/scripts/ (per AGENTS.md invariant)
  if (/\b(?:rm|cp|mv|cat|echo|sed|tee)\b.*packs\/behavior\/scripts\//.test(command) && !command.includes('clean')) {
    console.log(
      JSON.stringify({
        decision: 'deny',
        reason:
          'Safety Gate: Direct modification of packs/behavior/scripts/ is forbidden by AGENTS.md. Edit src/ and run bun build.',
      }),
    );
    process.exit(0);
  }

  // Default: allow execution
  console.log(JSON.stringify({ decision: 'allow' }));
}

main().catch(() => {
  console.log(JSON.stringify({ decision: 'allow' }));
});
