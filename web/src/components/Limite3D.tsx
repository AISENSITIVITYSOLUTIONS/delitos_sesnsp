import { Component } from 'react';
import type { ReactNode } from 'react';
/** A rendering or lazy-load failure must never take down the dashboard. */
export default class Limite3D extends Component<{children:ReactNode;onFallo:()=>void},{fallo:boolean}>{
 state={fallo:false};
 static getDerivedStateFromError(){return {fallo:true};}
 componentDidCatch(){this.props.onFallo();}
 render(){return this.state.fallo?null:this.props.children;}
}
