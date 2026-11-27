// Částka zlata slovem (bez zkratky „zl“): „1 zlatý“, jinak „N zlata“ – stejně jako ostatní texty hry.
export const goldText = (amount) => `${amount} ${Math.abs(Number(amount)) === 1 ? 'zlatý' : 'zlata'}`;
