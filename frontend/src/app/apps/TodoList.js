import React, { Component } from 'react'

export class TodoList extends Component {

    render() {
        return (
            <div>
                <div className="page-header">
                    <h3 className="page-title">
                        План аналитической смены
                    </h3>
                    <nav aria-label="breadcrumb">
                        <ol className="breadcrumb">
                        <li className="breadcrumb-item"><a href="!#" onClick={evt =>evt.preventDefault()}>Рабочая область</a></li>
                        <li className="breadcrumb-item active" aria-current="page">План смены</li>
                        </ol>
                    </nav>
                </div>
                <div className="row">
                    <div className="col-lg-12">
                        <div className="card px-3">
                            <div className="card-body">
                                <h4 className="card-title">План аналитической смены</h4>
                                <TodoListComponent />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

export class TodoListComponent extends Component {

    constructor(props) {
        super(props);
        this.state = { 
            todos: [
                {
                    id: 1,
                    task: 'Проверить инциденты с высоким risk score и confidence ниже 0.7',
                    isCompleted: false
                },
                {
                    id: 2,
                    task: 'Сопоставить подрядный доступ с профилями критичных объектов',
                    isCompleted: true
                },
                {
                    id: 3,
                    task: 'Подтвердить географические аномалии на карте инцидентов',
                    isCompleted: false
                },
                {
                    id: 4,
                    task: 'Обновить профиль угрозы по эксплуатации внешнего периметра',
                    isCompleted: false
                },
                {
                    id: 5,
                    task: 'Подготовить краткую сводку для владельца объекта КИИ',
                    isCompleted: true
                },
                {
                    id: 6,
                    task: 'Проверить новые публикации по DDoS и supply-chain',
                    isCompleted: false
                }
            ],
            inputValue: '',
        }

        this.statusChangedHandler = this.statusChangedHandler.bind(this);
        this.addTodo = this.addTodo.bind(this);
        this.removeTodo = this.removeTodo.bind(this);
        this.inputChangeHandler = this.inputChangeHandler.bind(this);
    }

    statusChangedHandler(event, id) {
        const todo = {...this.state.todos[id]};
        todo.isCompleted = event.target.checked;

        const todos = [...this.state.todos];
        todos[id] = todo;

        this.setState({
            todos: todos
        })
    }

    addTodo (event) {
        event.preventDefault();

        const todos = [...this.state.todos];
        todos.unshift({
            id: todos.length ? todos[todos.length - 1].id + 1 : 1,
            task: this.state.inputValue,
            isCompleted: false
            
        })

        this.setState({
            todos: todos,
            inputValue: ''
        })
    }

    removeTodo (index) {
        const todos = [...this.state.todos];
        todos.splice(index, 1);

        this.setState({
            todos: todos
        })
    }

    inputChangeHandler(event) {
        this.setState({
            inputValue: event.target.value
        });
    }

    render() {
        return (
            <>
                <form  className="add-items d-flex" onSubmit={this.addTodo}>
                    <input 
                        type="text" 
                        className="form-control h-auto" 
                        placeholder="Добавить задачу аналитической смены" 
                        value={this.state.inputValue} 
                        onChange={this.inputChangeHandler}
                        required />
                    <button type="submit" className="btn btn-primary">Добавить</button>
                </form>
                <div className="list-wrapper">
                    <ul className="d-flex flex-column todo-list">
                        {this.state.todos.map((todo, index) =>{
                            return <ListItem 
                            isCompleted={todo.isCompleted}
                            changed={(event) => this.statusChangedHandler(event, index)}
                            key={todo.id}
                            remove={() => this.removeTodo(index) }
                            >{todo.task}</ListItem>
                        })}
                    </ul>
                </div>
            </>
        )
    }
}

const ListItem = (props) => {
    
    return (
        <li className={(props.isCompleted ? 'completed' : null)}>
            <div className="form-check">
                <label htmlFor="" className="form-check-label"> 
                    <input className="checkbox" type="checkbox" 
                        checked={props.isCompleted} 
                        onChange={props.changed} 
                        /> {props.children} <i className="input-helper"></i>
                </label>
            </div>
            <i className="remove mdi mdi-close-box" onClick={props.remove}></i>
        </li>
    )
};

export default TodoList
