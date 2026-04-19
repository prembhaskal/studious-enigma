import { useState } from 'react'

const Button = ({ children, onClick, className = '' }) => (
  <button
    onClick={onClick}
    className={`p-4 text-xl font-semibold rounded-lg transition-colors ${className}`}
  >
    {children}
  </button>
)

function App() {
  const [display, setDisplay] = useState('0')
  const [previousValue, setPreviousValue] = useState(null)
  const [operator, setOperator] = useState(null)
  const [waitingForOperand, setWaitingForOperand] = useState(false)

  const inputDigit = (digit) => {
    if (waitingForOperand) {
      setDisplay(String(digit))
      setWaitingForOperand(false)
    } else {
      setDisplay(display === '0' ? String(digit) : display + digit)
    }
  }

  const inputDot = () => {
    if (waitingForOperand) {
      setDisplay('0.')
      setWaitingForOperand(false)
      return
    }

    if (!display.includes('.')) {
      setDisplay(display + '.')
    }
  }

  const clear = () => {
    setDisplay('0')
    setPreviousValue(null)
    setOperator(null)
    setWaitingForOperand(false)
  }

  const performOperation = (nextOperator) => {
    const inputValue = parseFloat(display)

    if (previousValue === null) {
      setPreviousValue(inputValue)
    } else if (operator) {
      const currentValue = previousValue || 0
      const newValue = calculate(currentValue, inputValue, operator)

      setPreviousValue(newValue)
      setDisplay(String(newValue))
    }

    setWaitingForOperand(true)
    setOperator(nextOperator)
  }

  const calculate = (prev, curr, op) => {
    switch (op) {
      case '+': return prev + curr
      case '-': return prev - curr
      case '*': return prev * curr
      case '/': return curr === 0 ? 'Error' : prev / curr
      default: return curr
    }
  }

  const handleEqual = () => {
    const inputValue = parseFloat(display)

    if (operator && previousValue !== null) {
      const result = calculate(previousValue, inputValue, operator)
      setDisplay(String(result))
      setPreviousValue(null)
      setOperator(null)
      setWaitingForOperand(true)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-xs">
        <div className="bg-gray-200 p-4 rounded-lg mb-4 text-right overflow-hidden">
          <div className="text-sm text-gray-500 h-5">
            {previousValue !== null ? `${previousValue} ${operator || ''}` : ''}
          </div>
          <div className="text-3xl font-bold truncate">
            {display}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Button onClick={clear} className="col-span-3 bg-red-100 text-red-600 hover:bg-red-200">
            Clear
          </Button>
          <Button onClick={() => performOperation('/')} className="bg-orange-100 text-orange-600 hover:bg-orange-200">
            ÷
          </Button>

          {[7, 8, 9].map(n => (
            <Button key={n} onClick={() => inputDigit(n)} className="bg-gray-100 hover:bg-gray-200">
              {n}
            </Button>
          ))}
          <Button onClick={() => performOperation('*')} className="bg-orange-100 text-orange-600 hover:bg-orange-200">
            ×
          </Button>

          {[4, 5, 6].map(n => (
            <Button key={n} onClick={() => inputDigit(n)} className="bg-gray-100 hover:bg-gray-200">
              {n}
            </Button>
          ))}
          <Button onClick={() => performOperation('-')} className="bg-orange-100 text-orange-600 hover:bg-orange-200">
            -
          </Button>

          {[1, 2, 3].map(n => (
            <Button key={n} onClick={() => inputDigit(n)} className="bg-gray-100 hover:bg-gray-200">
              {n}
            </Button>
          ))}
          <Button onClick={() => performOperation('+')} className="bg-orange-100 text-orange-600 hover:bg-orange-200">
            +
          </Button>

          <Button onClick={() => inputDigit(0)} className="col-span-2 bg-gray-100 hover:bg-gray-200">
            0
          </Button>
          <Button onClick={inputDot} className="bg-gray-100 hover:bg-gray-200">
            .
          </Button>
          <Button onClick={handleEqual} className="bg-orange-500 text-white hover:bg-orange-600">
            =
          </Button>
        </div>
      </div>
    </div>
  )
}

export default App
