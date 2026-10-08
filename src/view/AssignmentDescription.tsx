import type { GrammarDefinition } from '../models/types';
import { GrammarController } from '../controllers/GrammarController';

interface AssignmentDescriptionProps {
  description: string;
  solution?: GrammarDefinition;
}

/** Display the assignment condition together with the current or saved student alphabet. */
export default function AssignmentDescription({ description, solution }: AssignmentDescriptionProps) {
  const nonterminals = [...new Set([GrammarController.universalSymbol, ...(solution?.alphabet ? Array.from(solution.alphabet.nonterminals).filter(char => /^[A-Z]$/.test(char)) : solution?.variables.map(variable => variable.symbol).filter(Boolean) ?? [])])];
  return (
    <section className="assignment-summary">
      <h3>Условие задания</h3>
      <p className="description">{description}</p>
      {solution && <dl className="alphabet-description">
        <dt>Нетерминалы</dt><dd><code>{nonterminals.join(', ')}</code></dd>
        <dt>Терминалы</dt><dd className="alphabet-entries">
          {solution.alphabet && <code>{solution.alphabet.terminals || '∅'}</code>}
          {solution.variables.map((variable, index) => <code key={index}>{variable.symbol || '?'} = {variable.allowedValues || '∅'}</code>)}
          {!solution.alphabet && solution.terminals.length > 0 && <span>Буквальные: <code>{solution.terminals.map(char => char === ' ' ? '␣' : char).join(' ')}</code></span>}
          {solution.variables.length === 0 && solution.terminals.length === 0 && <span>Алфавит L — любой символ</span>}
        </dd>
      </dl>}
    </section>
  );
}
