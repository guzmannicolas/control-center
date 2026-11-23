import { useEffect, useState } from 'react';

export interface PythonLessonStep {
  step: number;
  codeLine: number;
  label: string;
  explanation: string;
  stack: { name: string; targetRef: string; scope: string }[];
  heap: { id: string; type: string; value: string; mutated?: boolean; highlighted?: boolean }[];
  activeArrow?: { from: string; to: string; label?: string };
}

export interface PythonLesson {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  code: string[];
  steps: PythonLessonStep[];
  productionTip: string;
  quiz: {
    question: string;
    options: string[];
    answer: number;
    explanation: string;
  };
}

export const PYTHON_LESSONS: PythonLesson[] = [
  {
    id: 'memory-model',
    title: 'Object References and Heap Memory',
    subtitle: 'Understand how Python handles pointers, shared references, and in-place mutability',
    category: 'Core Fundamentals',
    code: [
      '# Step 1: Initialize list in heap',
      'a = [10, 20]',
      '# Step 2: Reference assignment (shallow pointer)',
      'b = a',
      '# Step 3: Mutate in-place via pointer b',
      'b.append(30)',
      '# Step 4: Reassign a to a brand new object',
      'a = [100, 200]',
    ],
    steps: [
      {
        step: 0,
        codeLine: 1,
        label: 'Step 1: Allocation',
        explanation: 'Python allocates a PyListObject on the heap at memory address 0x101 and creates name "a" in local stack namespace pointing to it.',
        stack: [{ name: 'a', targetRef: '0x101', scope: 'locals' }],
        heap: [{ id: '0x101', type: 'list', value: '[10, 20]', highlighted: true }],
        activeArrow: { from: 'stack-a', to: 'heap-0x101', label: 'ref' },
      },
      {
        step: 1,
        codeLine: 3,
        label: 'Step 2: Reference Copy',
        explanation: 'Executing "b = a" does NOT duplicate the list. It creates variable "b" in the stack pointing to the EXACT same heap address (0x101).',
        stack: [
          { name: 'a', targetRef: '0x101', scope: 'locals' },
          { name: 'b', targetRef: '0x101', scope: 'locals' },
        ],
        heap: [{ id: '0x101', type: 'list', value: '[10, 20]', highlighted: true }],
        activeArrow: { from: 'stack-b', to: 'heap-0x101', label: 'shared ref' },
      },
      {
        step: 2,
        codeLine: 5,
        label: 'Step 3: In-Place Mutation',
        explanation: 'Calling b.append(30) modifies the object at 0x101 directly. Since "a" points to the same object, "a" now reflects [10, 20, 30] without any direct assignment to "a".',
        stack: [
          { name: 'a', targetRef: '0x101', scope: 'locals' },
          { name: 'b', targetRef: '0x101', scope: 'locals' },
        ],
        heap: [{ id: '0x101', type: 'list', value: '[10, 20, 30]', mutated: true, highlighted: true }],
        activeArrow: { from: 'stack-b', to: 'heap-0x101', label: 'mutates' },
      },
      {
        step: 3,
        codeLine: 7,
        label: 'Step 4: Pointer Re-binding',
        explanation: 'Executing "a = [100, 200]" allocates a new PyListObject at 0x102. Name "a" changes pointer, while "b" continues pointing to 0x101 unaffected.',
        stack: [
          { name: 'a', targetRef: '0x102', scope: 'locals' },
          { name: 'b', targetRef: '0x101', scope: 'locals' },
        ],
        heap: [
          { id: '0x101', type: 'list', value: '[10, 20, 30]' },
          { id: '0x102', type: 'list', value: '[100, 200]', highlighted: true },
        ],
        activeArrow: { from: 'stack-a', to: 'heap-0x102', label: 'new ref' },
      },
    ],
    productionTip: 'Never use mutable objects (like lists or dicts) as default parameter values: def fetch(cache={}). Default arguments are evaluated once at module load time, making the cache shared across all function calls across your entire application.',
    quiz: {
      question: 'Given x = [1, 2] and y = x, what is the output of y.append(3); print(x)?',
      options: ['[1, 2]', '[1, 2, 3]', 'TypeError: immutable reference', 'AttributeError'],
      answer: 1,
      explanation: 'Both x and y refer to the identical list in heap memory. Mutating through y immediately affects x.',
    },
  },
  {
    id: 'call-stack',
    title: 'Call Stack, Frame Scopes and Recursion',
    subtitle: 'Inspect activation records, stack frames, lexical scopes, and function returns',
    category: 'Runtime Architecture',
    code: [
      'def factorial(n):',
      '    if n <= 1:',
      '        return 1',
      '    return n * factorial(n - 1)',
      '',
      'result = factorial(3)',
    ],
    steps: [
      {
        step: 0,
        codeLine: 5,
        label: 'Step 1: Module Entry Point',
        explanation: 'Global module scope invokes factorial(3). Python creates a new PyFrameObject on top of the runtime call stack.',
        stack: [
          { name: '__main__', targetRef: 'global', scope: 'module' },
          { name: 'factorial(3)', targetRef: 'n=3', scope: 'frame-1' },
        ],
        heap: [{ id: 'n=3', type: 'int', value: '3', highlighted: true }],
      },
      {
        step: 1,
        codeLine: 3,
        label: 'Step 2: Recursive Push (n=2)',
        explanation: 'factorial(3) needs the result of factorial(2). A second frame is pushed to the stack. Frame 1 pauses execution and waits.',
        stack: [
          { name: '__main__', targetRef: 'global', scope: 'module' },
          { name: 'factorial(3)', targetRef: 'n=3', scope: 'frame-1 (waiting)' },
          { name: 'factorial(2)', targetRef: 'n=2', scope: 'frame-2 (active)' },
        ],
        heap: [
          { id: 'n=3', type: 'int', value: '3' },
          { id: 'n=2', type: 'int', value: '2', highlighted: true },
        ],
      },
      {
        step: 2,
        codeLine: 3,
        label: 'Step 3: Base Case Frame Push (n=1)',
        explanation: 'factorial(2) calls factorial(1). Frame 3 is created on top. Here n <= 1 evaluates to True (Base Case).',
        stack: [
          { name: '__main__', targetRef: 'global', scope: 'module' },
          { name: 'factorial(3)', targetRef: 'n=3', scope: 'frame-1 (waiting)' },
          { name: 'factorial(2)', targetRef: 'n=2', scope: 'frame-2 (waiting)' },
          { name: 'factorial(1)', targetRef: 'n=1', scope: 'frame-3 (base case)' },
        ],
        heap: [{ id: 'n=1', type: 'int', value: '1', highlighted: true }],
      },
      {
        step: 3,
        codeLine: 2,
        label: 'Step 4: Unwinding and Frame Popping',
        explanation: 'Frame 3 returns 1 and is popped. Frame 2 resumes: 2 * 1 = 2, returns 2 and is popped. Frame 1 resumes: 3 * 2 = 6, pops and assigns result = 6.',
        stack: [
          { name: '__main__', targetRef: 'result=6', scope: 'module' },
        ],
        heap: [{ id: 'result', type: 'int', value: '6', mutated: true, highlighted: true }],
      },
    ],
    productionTip: 'Python has a default recursion limit of 1,000 frames (sys.getrecursionlimit()) to prevent C stack overflow. For deep recursive workloads or tree traversals, convert to an iterative loop with an explicit collections.deque.',
    quiz: {
      question: 'What happens in Python when recursive depth exceeds sys.getrecursionlimit()?',
      options: ['Returns None silently', 'RecursionError: maximum recursion depth exceeded', 'Segfault / OS crash', 'Automatically converts to tail-call optimization'],
      answer: 1,
      explanation: 'Python raises RecursionError before the underlying C runtime stack can overflow, protecting process stability.',
    },
  },
  {
    id: 'generators',
    title: 'Generators, Iterators and Lazy Streams',
    subtitle: 'Compare 500MB list allocations vs 112-byte generator state machines',
    category: 'High-Performance Pipelines',
    code: [
      'def stream_numbers(limit):',
      '    n = 0',
      '    while n < limit:',
      '        yield n',
      '        n += 1',
      '',
      'stream = stream_numbers(1000000)',
      'first = next(stream)',
      'second = next(stream)',
    ],
    steps: [
      {
        step: 0,
        codeLine: 6,
        label: 'Step 1: Generator Initialization',
        explanation: 'Calling a function containing "yield" returns a Generator object instantly without executing the function body. Memory footprint: 112 bytes.',
        stack: [{ name: 'stream', targetRef: 'gen-obj', scope: 'locals' }],
        heap: [{ id: 'gen-obj', type: 'generator', value: 'stream_numbers (state: CREATED)', highlighted: true }],
      },
      {
        step: 1,
        codeLine: 7,
        label: 'Step 2: First next() Call',
        explanation: 'next(stream) advances execution until the first "yield n". The value 0 is emitted, and the generator frame freezes its local state (n=0).',
        stack: [
          { name: 'stream', targetRef: 'gen-obj', scope: 'locals' },
          { name: 'first', targetRef: 'val-0', scope: 'locals' },
        ],
        heap: [
          { id: 'gen-obj', type: 'generator', value: 'state: SUSPENDED at line 4 (n=0)' },
          { id: 'val-0', type: 'int', value: '0', highlighted: true },
        ],
      },
      {
        step: 2,
        codeLine: 8,
        label: 'Step 3: Second next() Call',
        explanation: 'next(stream) wakes up the generator frame right after yield. n is incremented to 1, loop cycles, and yields 1. Generator freezes again.',
        stack: [
          { name: 'stream', targetRef: 'gen-obj', scope: 'locals' },
          { name: 'first', targetRef: 'val-0', scope: 'locals' },
          { name: 'second', targetRef: 'val-1', scope: 'locals' },
        ],
        heap: [
          { id: 'gen-obj', type: 'generator', value: 'state: SUSPENDED at line 4 (n=1)' },
          { id: 'val-1', type: 'int', value: '1', highlighted: true },
        ],
      },
    ],
    productionTip: 'When processing large CSV files, database cursors, or AI token streams, always use generator expressions (x for x in data) rather than list comprehensions [x for x in data] to keep RAM consumption flat and constant.',
    quiz: {
      question: 'What is the main memory advantage of a generator over a standard Python list?',
      options: [
        'Generators compile code into C binary',
        'Generators evaluate items lazily on demand without holding the full collection in RAM',
        'Generators automatically parallelize over multiple CPU cores',
        'Generators bypass Python GIL lock',
      ],
      answer: 1,
      explanation: 'Generators yield one item at a time and suspend execution, requiring constant memory O(1) regardless of sequence size.',
    },
  },
  {
    id: 'async-loop',
    title: 'Async/Await and The Single-Threaded Event Loop',
    subtitle: 'Master asynchronous co-routines, non-blocking I/O, and cooperative multitasking',
    category: 'Concurrent Architecture',
    code: [
      'import asyncio',
      '',
      'async def fetch_api(source, delay):',
      '    print(f"Start {source}")',
      '    await asyncio.sleep(delay) # Yields to event loop',
      '    return f"{source} complete"',
      '',
      '# Run concurrent tasks',
      'await asyncio.gather(fetch_api("A", 2), fetch_api("B", 1))',
    ],
    steps: [
      {
        step: 0,
        codeLine: 8,
        label: 'Step 1: Task Scheduling',
        explanation: 'asyncio.gather creates two Task coroutine objects (Task A: 2s delay, Task B: 1s delay) and registers both in the Event Loop Ready Queue.',
        stack: [{ name: 'EventLoop', targetRef: 'loop-core', scope: 'runtime' }],
        heap: [
          { id: 'task-a', type: 'Task', value: 'fetch_api("A", 2) - State: PENDING' },
          { id: 'task-b', type: 'Task', value: 'fetch_api("B", 1) - State: PENDING', highlighted: true },
        ],
      },
      {
        step: 1,
        codeLine: 4,
        label: 'Step 2: Non-Blocking Yield',
        explanation: 'Task A executes until "await asyncio.sleep(2)". It delegates timer registration to the OS epoll/kqueue selector and yields control back to the event loop immediately.',
        stack: [{ name: 'EventLoop', targetRef: 'running-task-b', scope: 'runtime' }],
        heap: [
          { id: 'task-a', type: 'Task', value: 'AWAITING_TIMER (2.0s)' },
          { id: 'task-b', type: 'Task', value: 'RUNNING in frame', highlighted: true },
        ],
      },
      {
        step: 2,
        codeLine: 5,
        label: 'Step 3: Interleaved Completion',
        explanation: 'At t=1.0s, Task B timer fires first! Event loop wakes Task B, finishes execution, and collects its return value. Then at t=2.0s, Task A wakes and completes.',
        stack: [{ name: 'EventLoop', targetRef: 'all-resolved', scope: 'runtime' }],
        heap: [
          { id: 'result-b', type: 'str', value: '"B complete" (resolved in 1.0s)', mutated: true },
          { id: 'result-a', type: 'str', value: '"A complete" (resolved in 2.0s)', mutated: true },
        ],
      },
    ],
    productionTip: 'Never call blocking functions (such as time.sleep() or standard requests.get()) inside an async def function. Doing so blocks the single event loop thread, freezing all concurrent requests across your entire server.',
    quiz: {
      question: 'Why does Python async/await not require OS thread context-switching overhead?',
      options: [
        'It uses preemptive hardware interrupts',
        'Cooperative multitasking runs on a single thread where tasks explicitly yield during I/O waiting',
        'Python forks child processes for each await statement',
        'It runs on the GPU',
      ],
      answer: 1,
      explanation: 'Async functions are cooperative: execution only switches when code reaches an "await" expression yielding control to the event loop.',
    },
  },
];

export function PythonStudio() {
  const [selectedLessonId, setSelectedLessonId] = useState<string>('memory-model');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1800);
  const [quizSelection, setQuizSelection] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);

  const lesson = PYTHON_LESSONS.find((l) => l.id === selectedLessonId) ?? PYTHON_LESSONS[0]!;
  const currentStep = lesson.steps[currentStepIndex] ?? lesson.steps[0]!;

  // Reset step and quiz on lesson change
  useEffect(() => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
    setQuizSelection(null);
    setQuizSubmitted(false);
  }, [selectedLessonId]);

  // Autoplay loop
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev >= lesson.steps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, playbackSpeed);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, lesson.steps.length]);

  const handleNext = () => {
    if (currentStepIndex < lesson.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleReset = () => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Lesson Selector Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.75rem' }}>
        {PYTHON_LESSONS.map((item) => {
          const isActive = item.id === lesson.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedLessonId(item.id)}
              style={{
                background: isActive ? '#1e293b' : '#0b0f19',
                border: `1px solid ${isActive ? '#38bdf8' : '#334155'}`,
                color: isActive ? '#38bdf8' : '#94a3b8',
                borderRadius: '8px',
                padding: '0.45rem 0.9rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{item.title}</span>
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '4px',
                  background: isActive ? '#0369a1' : '#1e293b',
                  color: isActive ? '#f0f9ff' : '#64748b',
                }}
              >
                {item.category}
              </span>
            </button>
          );
        })}
      </div>

      {/* Lesson Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0b0f19 0%, #031326 100%)',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
            {lesson.title}
          </h2>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: '20px',
              background: '#0c4a6e',
              border: '1px solid #0284c7',
              color: '#38bdf8',
            }}
          >
            Step {currentStepIndex + 1} of {lesson.steps.length}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>{lesson.subtitle}</p>
      </div>

      {/* Playback Controls and Step Navigator */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#050811',
          border: '1px solid #1e293b',
          borderRadius: '10px',
          padding: '0.6rem 1rem',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: currentStepIndex === 0 ? '#475569' : '#cbd5e1',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: currentStepIndex === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Previous Step
          </button>

          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              background: isPlaying ? '#854d0e' : '#0369a1',
              border: `1px solid ${isPlaying ? '#eab308' : '#38bdf8'}`,
              color: '#ffffff',
              borderRadius: '6px',
              padding: '0.35rem 0.9rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {isPlaying ? 'Pause Animation' : 'Play Animated Workflow'}
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={currentStepIndex === lesson.steps.length - 1}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: currentStepIndex === lesson.steps.length - 1 ? '#475569' : '#cbd5e1',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: currentStepIndex === lesson.steps.length - 1 ? 'not-allowed' : 'pointer',
            }}
          >
            Next Step
          </button>

          <button
            type="button"
            onClick={handleReset}
            style={{
              background: 'transparent',
              border: '1px solid #334155',
              color: '#94a3b8',
              borderRadius: '6px',
              padding: '0.35rem 0.6rem',
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>

        {/* Speed Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#94a3b8' }}>
          <span>Speed:</span>
          {[2400, 1800, 1000].map((speed, i) => (
            <button
              key={speed}
              type="button"
              onClick={() => setPlaybackSpeed(speed)}
              style={{
                background: playbackSpeed === speed ? '#1e293b' : 'transparent',
                border: `1px solid ${playbackSpeed === speed ? '#38bdf8' : '#334155'}`,
                color: playbackSpeed === speed ? '#38bdf8' : '#94a3b8',
                borderRadius: '4px',
                padding: '0.2rem 0.45rem',
                fontSize: '0.72rem',
                cursor: 'pointer',
              }}
            >
              {['0.75x', '1x', '1.75x'][i]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Grid: Code vs Moving Workflow Visualizer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1.4fr)', gap: '1rem' }}>
        {/* Left Column: Code Inspector with Active Line Highlighting */}
        <div
          style={{
            background: '#050811',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8' }}>
              Execution Pointer (CPython Frame)
            </span>
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
              line {currentStep.codeLine + 1}
            </span>
          </div>

          <div
            style={{
              background: '#0b0f19',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              padding: '0.75rem 0.5rem',
              fontFamily: 'monospace',
              fontSize: '0.82rem',
              lineHeight: '1.6',
              overflowX: 'auto',
            }}
          >
            {lesson.code.map((line, idx) => {
              const isCurrent = idx === currentStep.codeLine;
              return (
                <div
                  key={line + idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    background: isCurrent ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    borderLeft: isCurrent ? '3px solid #38bdf8' : '3px solid transparent',
                    color: isCurrent ? '#f8fafc' : '#94a3b8',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span style={{ width: '1.8rem', color: isCurrent ? '#38bdf8' : '#475569', fontSize: '0.72rem', userSelect: 'none' }}>
                    {idx + 1}
                  </span>
                  <span style={{ color: line.startsWith('#') ? '#64748b' : isCurrent ? '#38bdf8' : '#e2e8f0' }}>
                    {line}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Current Step Narrative Explanation */}
          <div
            style={{
              background: '#031326',
              border: '1px solid #0284c7',
              borderRadius: '8px',
              padding: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
              <strong style={{ fontSize: '0.82rem', color: '#38bdf8' }}>{currentStep.label}</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.5' }}>
              {currentStep.explanation}
            </p>
          </div>
        </div>

        {/* Right Column: Moving Workflow and Memory Visualizer */}
        <div
          style={{
            background: '#050811',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#34d399' }}>
              Moving Data Flow & Memory Graph
            </span>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
              Stack Pointers to Heap Objects
            </span>
          </div>

          {/* SVG Animated Flow Diagram */}
          <div
            style={{
              position: 'relative',
              background: '#0b0f19',
              border: '1px solid #1e293b',
              borderRadius: '10px',
              minHeight: '220px',
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              overflow: 'hidden',
            }}
          >
            {/* SVG Connecting Flow Lines with Animation */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            >
              <defs>
                <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
              </defs>
              <line
                x1="35%"
                y1="50%"
                x2="65%"
                y2="50%"
                stroke="url(#flowGrad)"
                strokeWidth="2.5"
                strokeDasharray="6,4"
                style={{
                  animation: isPlaying ? 'dashAnimation 1s linear infinite' : 'none',
                }}
              />
            </svg>

            {/* Stack Column (Left side of visualization) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', zIndex: 2, minWidth: '130px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Stack (Names)
              </span>
              {currentStep.stack.map((item) => (
                <div
                  key={item.name}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #38bdf8',
                    boxShadow: '0 0 10px rgba(56, 189, 248, 0.2)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.15rem',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#38bdf8', fontFamily: 'monospace' }}>
                    ptr &rarr; {item.targetRef}
                  </span>
                </div>
              ))}
            </div>

            {/* Center Flow Indicator Indicator */}
            <div
              style={{
                zIndex: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.2rem',
                background: '#050811',
                border: '1px solid #334155',
                borderRadius: '20px',
                padding: '0.25rem 0.6rem',
              }}
            >
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#38bdf8' }}>
                {isPlaying ? 'FLOW ACTIVE' : 'STEADY STATE'}
              </span>
            </div>

            {/* Heap Column (Right side of visualization) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', zIndex: 2, minWidth: '160px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Heap (PyObjects)
              </span>
              {currentStep.heap.map((obj) => (
                <div
                  key={obj.id}
                  style={{
                    background: obj.mutated ? 'rgba(52, 211, 153, 0.15)' : '#0f172a',
                    border: `1px solid ${obj.mutated ? '#34d399' : obj.highlighted ? '#38bdf8' : '#334155'}`,
                    boxShadow: obj.mutated ? '0 0 12px rgba(52, 211, 153, 0.3)' : 'none',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', fontFamily: 'monospace' }}>
                      {obj.id}
                    </span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        padding: '0.05rem 0.3rem',
                        borderRadius: '3px',
                        background: '#1e293b',
                        color: '#a78bfa',
                      }}
                    >
                      {obj.type}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                    {obj.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive State Summary Table */}
          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.75rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
              Runtime Inspection Table
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
              <div style={{ background: '#050811', padding: '0.4rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Active Frames</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8' }}>{currentStep.stack.length}</div>
              </div>
              <div style={{ background: '#050811', padding: '0.4rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Heap Objects</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399' }}>{currentStep.heap.length}</div>
              </div>
              <div style={{ background: '#050811', padding: '0.4rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Memory State</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#a78bfa' }}>Mutated</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Production Engineering Tip */}
      <div
        style={{
          background: '#081726',
          borderLeft: '4px solid #38bdf8',
          borderRadius: '8px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}
      >
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Production Architecture Note
        </span>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.6' }}>
          {lesson.productionTip}
        </p>
      </div>

      {/* Interactive Micro-Quiz */}
      <div
        style={{
          background: '#050811',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
            Concept Check: {lesson.title}
          </h3>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>1 question</span>
        </div>

        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>
          {lesson.quiz.question}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {lesson.quiz.options.map((option, idx) => {
            const isSelected = quizSelection === idx;
            const isCorrect = idx === lesson.quiz.answer;
            let borderStyle = '#1e293b';
            let bgStyle = '#0b0f19';

            if (quizSubmitted) {
              if (isCorrect) {
                borderStyle = '#10b981';
                bgStyle = 'rgba(16, 185, 129, 0.1)';
              } else if (isSelected) {
                borderStyle = '#ef4444';
                bgStyle = 'rgba(239, 68, 68, 0.1)';
              }
            } else if (isSelected) {
              borderStyle = '#38bdf8';
              bgStyle = 'rgba(56, 189, 248, 0.08)';
            }

            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  if (!quizSubmitted) setQuizSelection(idx);
                }}
                style={{
                  background: bgStyle,
                  border: `1px solid ${borderStyle}`,
                  color: '#e2e8f0',
                  borderRadius: '6px',
                  padding: '0.6rem 0.85rem',
                  fontSize: '0.8rem',
                  textAlign: 'left',
                  cursor: quizSubmitted ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  transition: 'all 0.15s ease',
                }}
              >
                <span
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: `1px solid ${isSelected ? '#38bdf8' : '#475569'}`,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: isSelected ? '#38bdf8' : '#64748b',
                  }}
                >
                  {String.fromCharCode(65 + idx)}
                </span>
                <span>{option}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
          {!quizSubmitted ? (
            <button
              type="button"
              disabled={quizSelection === null}
              onClick={() => setQuizSubmitted(true)}
              style={{
                background: quizSelection === null ? '#1e293b' : '#0284c7',
                border: '1px solid #0369a1',
                color: quizSelection === null ? '#64748b' : '#ffffff',
                borderRadius: '6px',
                padding: '0.4rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: quizSelection === null ? 'not-allowed' : 'pointer',
              }}
            >
              Check Answer
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
              <div
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: quizSelection === lesson.quiz.answer ? '#34d399' : '#f87171',
                }}
              >
                {quizSelection === lesson.quiz.answer ? 'Correct! ' : 'Not quite. '}
                <span style={{ fontWeight: 400, color: '#cbd5e1' }}>{lesson.quiz.explanation}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQuizSubmitted(false);
                  setQuizSelection(null);
                }}
                style={{
                  alignSelf: 'flex-start',
                  background: 'transparent',
                  border: '1px solid #334155',
                  color: '#94a3b8',
                  borderRadius: '4px',
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  marginTop: '0.25rem',
                }}
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
