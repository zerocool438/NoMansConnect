import React from 'react';
import ReactMarkdown from 'react-markdown';
import openExternal from 'open-external';
import {defer} from 'lodash';
import {cleanUp} from './utils';

const iconStyle = {
  position: 'relative',
  top: '-2px'
};

class Item extends React.Component {
  static defaultProps = {
    dataTip: null,
    onValueClick: null
  };
  constructor(props) {
    super(props);
  }
  handleDescClick = (e) => {
    e.preventDefault();
    openExternal(e.target.href);
  }
  componentDidMount(){
    if (this.props.label === 'Description') {
      defer(()=>{
        if (this.descriptionRef) {
          this.descriptionRef.addEventListener('click', this.handleDescClick);
        }
      });
    }
  }
  componentWillUnmount(){
    window.removeEventListener('resize', this.onWindowResize);
    if (this.descriptionRef) {
      this.descriptionRef.removeEventListener('click', this.handleDescClick);
    }
    cleanUp(this);
  }
  getRef = (ref) => {
    this.descriptionRef = ref;
  }
  render(){
    if (this.props.label === 'Description') {
      return (
        <div
        ref={this.getRef}
        className="Item__wrapperStyle">
          <ReactMarkdown className="md-p" source={this.props.value} />
        </div>
      );
    } else {
      return (
        <div
        className={`Item__wrapperStyle${this.props.className ? ` ${this.props.className}` : ''}${this.props.onValueClick ? ' cursorPointer' : ''}`}
        onClick={this.props.onValueClick}
        data-place="top"
        data-tip={this.props.dataTip}>
          <span className="Item__labelStyle">{`${this.props.label}`}</span>
          {this.props.label === 'Portal Address' ?
          <span className="Item__valueStyle Item__portal">
            {this.props.children}
          </span>
          :
          <span
          className="Item__valueStyle">
            {this.props.value ? this.props.value
            : this.props.icon ?
            <i
            style={iconStyle}
            className={`${this.props.icon} icon`} />
            : null}
          </span>}
        </div>
      );
    }
  }
};

export default Item;