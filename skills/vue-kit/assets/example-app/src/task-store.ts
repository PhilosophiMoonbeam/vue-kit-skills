import { defineStore } from 'pinia'

export interface Task {
  id: number
  title: string
  done: boolean
}

export const TASK_TITLE_MAX_LENGTH = 80

function initialTasks(): Task[] {
  return [
    { id: 1, title: 'Explore the workbench', done: false },
    { id: 2, title: 'Try keyboard navigation', done: true },
  ]
}

export const useTasksStore = defineStore('tasks', {
  state: () => ({
    tasks: initialTasks(),
    nextId: 3,
  }),
  actions: {
    addTask(title: string): void {
      this.tasks.push({ id: this.nextId++, title: title.trim(), done: false })
    },
    toggleTask(id: number): void {
      const task = this.tasks.find((item) => item.id === id)
      if (task) task.done = !task.done
    },
    removeTask(id: number): void {
      const index = this.tasks.findIndex((item) => item.id === id)
      if (index !== -1) this.tasks.splice(index, 1)
    },
    resetTasks(): void {
      this.tasks = initialTasks()
      this.nextId = 3
    },
  },
})
