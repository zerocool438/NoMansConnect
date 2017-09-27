import state from './state';
import React from 'react';
import autoBind from 'react-autobind';
import _ from 'lodash';

import {whichToShow} from './utils';
import each from './each';
import {BasicDropdown} from './dropdowns';
import LocationBox from './locationBox';

class RemoteLocations extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      init: true
    };
    autoBind(this);
    this.range = {start: 0, length: 0};
  }
  componentDidMount(){
    this.uiSegmentStyle = {
      background: 'rgba(23, 26, 22, 0.9)',
      display: 'inline-table',
      borderTop: '2px solid #95220E',
      textAlign: 'center',
      WebkitUserSelect: 'none',
      paddingRight: '0px'
    };
    let checkRemote = ()=>{
      if (this.props.s.remoteLocations && this.props.s.remoteLocations.results) {
        this.recentExplorations.addEventListener('scroll', this.handleScroll);
        this.setState({init: false});
        this.setViewableRange(this.recentExplorations);
      } else {
        _.delay(()=>checkRemote(), 500);
      }
    };
    checkRemote();
    this.throttledPagination = _.throttle(this.props.onPagination, 1000, {leading: true});
  }
  shouldComponentUpdate(nextProps) {
    return (nextProps.s.remoteLocations.results !== this.props.s.remoteLocations.results
      || this.props.s.search.length > 0
      || nextProps.s.searchCache.results !== this.props.s.searchCache.results
      || nextProps.s.favorites !== this.props.s.favorites
      || nextProps.updating !== this.props.updating
      || nextProps.s.installing !== this.props.s.installing
      || nextProps.s.width !== this.props.s.width
      || nextProps.s.remoteLocationsColumns !== this.props.s.remoteLocationsColumns
      || nextProps.s.compactRemote !== this.props.s.compactRemote
      || nextProps.s.showOnlyScreenshots !== this.props.s.showOnlyScreenshots
      || nextProps.s.showOnlyNames !== this.props.s.showOnlyNames
      || nextProps.s.showOnlyDesc !== this.props.s.showOnlyDesc
      || nextProps.s.showOnlyGalaxy !== this.props.s.showOnlyGalaxy
      || nextProps.s.showOnlyBases !== this.props.s.showOnlyBases
      || nextProps.s.showOnlyPC !== this.props.s.showOnlyPC
      || nextProps.s.selectedGalaxy !== this.props.s.selectedGalaxy
      || nextProps.s.sortByDistance !== this.props.s.sortByDistance
      || nextProps.s.sortByModded !== this.props.s.sortByModded
      || nextProps.s.showOnlyCompatible !== this.props.s.showOnlyCompatible
      || this.state.init)
  }
  componentWillReceiveProps(nextProps){
    let searchChanged = nextProps.s.searchCache.results !== this.props.s.searchCache.results;
    if (nextProps.s.sort !== this.props.s.sort && this.recentExplorations || searchChanged) {
      this.recentExplorations.scrollTop = 0;
    }

    if (nextProps.s.remoteLocationsColumns !== this.props.s.remoteLocationsColumns
      || nextProps.s.compactRemote !== this.props.s.compactRemote) {
      _.defer(()=>this.setViewableRange(this.recentExplorations));
    }
  }
  componentWillUnmount(){
    if (this.recentExplorations) {
      this.recentExplorations.removeEventListener('scroll', this.handleScroll);
    }
  }
  setViewableRange(node){
    if (!node) {
      return;
    }
    let itemHeight = this.props.s.compactRemote ? 68 : 245;
    this.range = whichToShow({
      outerHeight: node.clientHeight,
      scrollTop: node.scrollTop,
      itemHeight: itemHeight + 26,
      columns: this.props.s.remoteLocationsColumns
    });
    this.forceUpdate();
  }
  handleScroll(){
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.scrollTimeout = setTimeout(this.scrollListener, 25);
  }
  scrollListener(){
    if (!this.recentExplorations) {
      return;
    }
    this.setViewableRange(this.recentExplorations);

    if (this.props.s.searchCache.results.length > 0) {
      return;
    }

    if (this.props.s.remoteLength >= this.props.s.remoteLocations.count - this.props.s.pageSize) {
      return;
    }

    if (this.recentExplorations.scrollTop + window.innerHeight >= this.recentExplorations.scrollHeight + this.recentExplorations.offsetTop - 180) {
      this.throttledPagination(this.props.s.page);
      _.delay(()=>{
        this.recentExplorations.scrollTop = Math.floor(this.recentExplorations.scrollHeight - this.props.s.pageSize * 271);
      }, 1500);
    }
  }
  handleFavorite(location, upvote){
    this.props.onFav(location, upvote);
  }
  getRef(ref){
    this.recentExplorations = ref;
  }
  render(){
    let p = this.props;
    let remoteLocationsWidth;
    if (p.s.remoteLocationsColumns === 1) {
      remoteLocationsWidth = '441px';
    } else if (p.s.remoteLocationsColumns === 2) {
      remoteLocationsWidth = '902px';
    } else {
      remoteLocationsWidth = '1300px';
    }
    let containerStyle = {
      position: 'absolute',
      right: '54px',
      zIndex: '91',
      maxWidth: remoteLocationsWidth,
    };
    let uiSegmentsStyle = {
      display: 'inline-flex',
      paddingTop: '14px',
      width: '400px !important'
    };
    let innerContainerStyle = {
      maxHeight: `${p.s.height - 125}px`,
      width: remoteLocationsWidth,
      minWidth: '400px',
      maxWidth: remoteLocationsWidth,
      overflowY: 'auto',
      overflowX: 'hidden',
      position: 'relative'
    };

    let leftOptions = [
      {
        id: 'remoteLocationsColumns',
        label: `Max Columns: ${p.s.remoteLocationsColumns}`,
        onClick: ()=>state.set({remoteLocationsColumns: p.s.remoteLocationsColumns === 1 ? 2 : p.s.remoteLocationsColumns === 2 ? 3 : 1})
      },
      {
        id: 'compactRemote',
        label: 'Compact View',
        toggle: this.props.s.compactRemote,
        onClick: ()=>state.set({compactRemote: !p.s.compactRemote})
      },
      {
        id: 'showOnlyGalaxy',
        label: `Show Only Locations From ${state.galaxies[p.s.selectedGalaxy]}`,
        toggle: this.props.s.showOnlyGalaxy,
        onClick: ()=>state.set({showOnlyGalaxy: !this.props.s.showOnlyGalaxy})
      },
      {
        id: 'showOnlyPC',
        label: 'Show Only PC Locations',
        toggle: this.props.s.showOnlyPC,
        onClick: ()=>state.set({showOnlyPC: !this.props.s.showOnlyPC})
      },
      {
        id: 'showOnlyScreenshots',
        label: 'Show Only Locations With Screenshots',
        toggle: this.props.s.showOnlyScreenshots,
        onClick: ()=>state.set({showOnlyScreenshots: !this.props.s.showOnlyScreenshots})
      },
      {
        id: 'showOnlyNames',
        label: 'Show Only Locations With Names',
        toggle: this.props.s.showOnlyNames,
        onClick: ()=>state.set({showOnlyNames: !this.props.s.showOnlyNames})
      },
      {
        id: 'showOnlyDesc',
        label: 'Show Only Locations With Descriptions',
        toggle: this.props.s.showOnlyDesc,
        onClick: ()=>state.set({showOnlyDesc: !this.props.s.showOnlyDesc})
      },
      {
        id: 'showOnlyBases',
        label: 'Show Only Locations With Bases: On',
        toggle: this.props.s.showOnlyBases,
        onClick: ()=>state.set({showOnlyBases: !this.props.s.showOnlyBases})
      },
      {
        id: 'showOnlyCompatible',
        label: 'Show Only Version Compatible Locations',
        toggle: this.props.s.showOnlyCompatible,
        onClick: ()=>state.set({showOnlyCompatible: !this.props.s.showOnlyCompatible})
      },
      {
        id: 'sortByDistance',
        label: 'Sort by Distance to Center',
        toggle: this.props.s.sortByDistance,
        onClick: ()=>state.set({sortByDistance: !this.props.s.sortByDistance})
      },
      {
        id: 'sortByModded',
        label: 'Sort by Least Modded: On',
        toggle: this.props.s.sortByModded,
        onClick: ()=>state.set({sortByModded: !this.props.s.sortByModded})
      }
    ];
    if (p.s.remoteLocations && p.s.remoteLocations.results && p.s.searchCache.results.length === 0 && p.s.remoteLength < p.s.remoteLocations.count - p.s.pageSize) {
      leftOptions.push({
        id: 'loadMore',
        label: `Load ${p.s.pageSize} More Locations`,
        onClick: ()=>this.throttledPagination(p.s.page)
      });
    }
    let parenthesis = p.s.offline || p.s.remoteLength === 0 ? '' : `(${p.s.remoteLength})`;
    let criteria = p.s.offline ? 'Cached' : p.s.sort === '-created' ? 'Recent' : p.s.sort === '-score' ? 'Favorite' : 'Popular';
    let title = p.s.searchCache.results.length > 0 ? p.s.searchCache.count === 0 ? `No results for "${p.s.search}"` : `${p.s.search} (${p.s.searchCache.count})` : p.s.remoteLocations.count === 0 ? 'Loading...' : `${criteria} Explorations ${parenthesis}`
    let locations = p.s.searchCache.results.length > 0 ? p.s.searchCache.results : p.s.remoteLocations.results;
    if (this.props.s.showOnlyScreenshots) {
      locations = _.filter(locations, (location)=>{
        return location.image.length > 0;
      });
    }
    if (this.props.s.showOnlyNames) {
      locations = _.filter(locations, (location)=>{
        return location.data.name && location.data.name.length > 0;
      });
    }
    if (this.props.s.showOnlyDesc) {
      locations = _.filter(locations, (location)=>{
        return location.data.description && location.data.description.length > 0;
      });
    }
    if (this.props.s.showOnlyGalaxy) {
      locations = _.filter(locations, (location)=>{
        return location.data.galaxy === p.s.selectedGalaxy;
      });
    }
    if (this.props.s.showOnlyBases) {
      locations = _.filter(locations, (location)=>{
        return location.data.base;
      });
    }
    if (this.props.s.showOnlyCompatible && this.props.s.saveVersion) {
      locations = _.filter(locations, (location)=>{
        return location.version === this.props.s.saveVersion || location.data.version === this.props.s.saveVersion;
      });
    }
    if (this.props.s.showOnlyPC) {
      locations = _.filter(locations, (location)=>{
        return location.data.playerPosition && !location.data.manuallyEntered;
      });
    }
    if (this.props.s.sortByDistance || this.state.sortByModded) {
      locations = _.orderBy(locations, (location)=>{
        if (!location.data.mods) {
          location.data.mods = [];
        }
        if (this.props.s.sortByModded && this.props.s.sortByDistance) {
          return location.data.mods.length + location.data.distanceToCenter;
        } else if (this.props.s.sortByDistance) {
          return location.data.distanceToCenter;
        } else if (this.props.s.sortByModded) {
          return location.data.mods.length;
        }
      });
    }
    let invisibleStyle = {
      height: `${(p.s.compactRemote ? 68 : 245) + 26}px`
    };
    let _locations = Array(locations.length);
    each(locations, (location, i)=>{
      location.data.teleports = location.teleports;
      location.upvote = location.data.upvote;
      let isVisible = i >= this.range.start && i <= this.range.start + this.range.length;
      if (isVisible) {
        _locations[i] = (
          <LocationBox
          key={location.id}
          i={i}
          scrollTop={this.recentExplorations ? this.recentExplorations.scrollTop : 0}
          isVisible={true}
          name={location.name}
          description={location.description}
          username={p.s.username}
          isOwnLocation={p.isOwnLocation}
          location={location.data}
          installing={p.s.installing}
          updating={p.updating}
          favorites={p.s.favorites}
          image={location.image}
          version={p.s.saveVersion ? location.version === p.s.saveVersion || location.data.version === p.s.saveVersion : null}
          onFav={this.handleFavorite}
          onTeleport={p.onTeleport}
          onSaveBase={p.onSaveBase}
          onCompactRemoteSwitch={this.setViewableRange}
          ps4User={p.ps4User}
          compactRemote={p.s.compactRemote}
          configDir={p.s.configDir} />
        );
      } else {
        _locations[i] = (
          <div
          key={location.id}
          style={invisibleStyle} />
        );
      }
    });
    locations = undefined;
    return (
      <div className="columns" style={containerStyle}>
        <div className="ui segments" style={uiSegmentsStyle}>
          <div className="ui segment" style={this.uiSegmentStyle}>
            <h3>{title}</h3>
            <div style={{
              position: 'absolute',
              left: '17px',
              top: '16px'
            }}>
              <BasicDropdown
              width={350}
              icon="ellipsis horizontal"
              showValue={null}
              persist={true}
              options={leftOptions} />
            </div>
            <div
            style={innerContainerStyle}
            ref={this.getRef}>
              {_locations}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default RemoteLocations;