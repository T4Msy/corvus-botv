'use strict'

const NUMS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
]

function emptyBoard () {
  return Array(9).fill(null)
}

function winner (board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a]
  }
  return null
}

function isFull (board) {
  return board.every(Boolean)
}

/** Desenha o tabuleiro 3x3 (❌/⭕ ou o número da casa livre). */
function render (board) {
  const cell = (i) => (board[i] === 'X' ? '❌' : board[i] === 'O' ? '⭕' : NUMS[i])
  const rows = [0, 3, 6].map((r) => `${cell(r)}${cell(r + 1)}${cell(r + 2)}`)
  return rows.join('\n')
}

module.exports = { emptyBoard, winner, isFull, render }
