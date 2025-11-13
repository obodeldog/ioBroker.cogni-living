import React from 'react';
import { withStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import I18n from '@iobroker/adapter-react/i18n';
import TextField from '@material-ui/core/TextField';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Button from '@material-ui/core/Button';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import ListIcon from '@material-ui/icons/List';
import IconButton from '@material-ui/core/IconButton';
import DialogSelectID from '@iobroker/adapter-react/Dialogs/SelectID';

const styles = () => ({
    tableInput: {
        width: '100%',
        minWidth: '150px',
    },
    input: {
        marginTop: 0,
        minWidth: 400,
    },
    button: {
        marginRight: 20,
    },
    card: {
        maxWidth: 345,
        textAlign: 'center',
    },
    media: {
        height: 180,
    },
    column: {
        display: 'inline-block',
        verticalAlign: 'top',
        marginRight: 20,
    },
    columnLogo: {
        width: 350,
        marginRight: 0,
    },
    columnSettings: {
        width: 'calc(100% - 370px)',
    },
    controlElement: {
        marginBottom: 5,
    },
    tab: {
        width: '100%',
    },
});

class Settings extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            devices: props.native.devices || [],
            showSelectId: false,
            selectIdIndex: -1
        };
    }

    updateDevices(newDevices) {
        this.setState({ devices: newDevices });
        this.props.onChange('devices', newDevices);
    }

    onAddDevice() {
        const devices = JSON.parse(JSON.stringify(this.state.devices));
        devices.push({
            id: '',
            name: '',
            location: '',
            type: '',
        });
        this.updateDevices(devices);
    }

    onDeviceChange(index, attr, value) {
        const devices = JSON.parse(JSON.stringify(this.state.devices));
        devices[index][attr] = value;
        this.updateDevices(devices);
    }

    onDeleteDevice(index) {
        const devices = JSON.parse(JSON.stringify(this.state.devices));
        devices.splice(index, 1);
        this.updateDevices(devices);
    }

    openSelectIdDialog(index) {
        this.setState({
            showSelectId: true,
            selectIdIndex: index
        });
    }

    // === HIER IST DIE MAGIE FÜR DEN AUTOMATISCHEN NAMEN ===
    onSelectId(selectedId) {
        const index = this.state.selectIdIndex;
        if (selectedId && index !== -1) {
            const devices = JSON.parse(JSON.stringify(this.state.devices));
            
            // 1. ID setzen
            devices[index].id = selectedId;

            // 2. Versuchen, den Namen automatisch zu holen
            this.props.socket.getObject(selectedId)
                .then((obj) => {
                    if (obj && obj.common && obj.common.name) {
                        let name = obj.common.name;
                        
                        // Falls der Name mehrsprachig ist (Objekt), nehmen wir die aktuelle Sprache
                        if (typeof name === 'object') {
                            // @ts-ignore
                            name = name[I18n.getLanguage()] || name.en || name.de || JSON.stringify(name);
                        }
                        
                        // Namen automatisch eintragen
                        devices[index].name = name;
                        this.updateDevices(devices);
                    } else {
                        // Kein Name gefunden? Wir speichern zumindest die ID
                        this.updateDevices(devices);
                    }
                })
                .catch((err) => {
                    // Falls was schief geht (keine Rechte etc.), speichern wir trotzdem die ID
                    console.error(err);
                    this.updateDevices(devices);
                });
        }
        this.setState({ showSelectId: false, selectIdIndex: -1 });
    }

    renderSelectIdDialog() {
        if (!this.state.showSelectId) {
            return null;
        }
        const currentId = this.state.devices[this.state.selectIdIndex]?.id || '';

        return (
            <DialogSelectID
                imagePrefix="../.."
                dialogName="selectID"
                themeType={this.props.themeType}
                socket={this.props.socket}
                selected={currentId}
                onClose={() => this.setState({ showSelectId: false })}
                onOk={(selected) => this.onSelectId(selected)}
            />
        );
    }

    render() {
        const { classes } = this.props;
        const { devices } = this.state;

        return (
            <>
                {this.renderSelectIdDialog()}

                <Typography variant="h6" gutterBottom>
                    {I18n.t('headline_sensor_config')}
                </Typography>

                <form className={classes.tab}>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{I18n.t('table_sensor_id')}</TableCell>
                                    <TableCell>Name</TableCell>
                                    <TableCell>{I18n.t('table_location')}</TableCell>
                                    <TableCell>{I18n.t('table_type')}</TableCell>
                                    <TableCell style={{ width: '50px' }}>{I18n.t('table_delete')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {devices.map((device, index) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <TextField
                                                    className={classes.tableInput}
                                                    value={device.id}
                                                    onChange={(e) =>
                                                        this.onDeviceChange(index, 'id', e.target.value)
                                                    }
                                                    placeholder="hm-rpc.0..."
                                                />
                                                <IconButton
                                                    size="small"
                                                    onClick={() => this.openSelectIdDialog(index)}
                                                    title="Select ID"
                                                >
                                                    <ListIcon />
                                                </IconButton>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                className={classes.tableInput}
                                                value={device.name || ''}
                                                onChange={(e) =>
                                                    this.onDeviceChange(index, 'name', e.target.value)
                                                }
                                                placeholder="Wird automatisch gefüllt"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                className={classes.tableInput}
                                                value={device.location}
                                                onChange={(e) =>
                                                    this.onDeviceChange(index, 'location', e.target.value)
                                                }
                                                placeholder="z.B. Bad"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                className={classes.tableInput}
                                                value={device.type}
                                                onChange={(e) =>
                                                    this.onDeviceChange(index, 'type', e.target.value)
                                                }
                                                placeholder="z.B. Bewegung"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <IconButton
                                                size="small"
                                                onClick={() => this.onDeleteDevice(index)}
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon />}
                        style={{ marginTop: '20px' }}
                        onClick={() => this.onAddDevice()}
                    >
                        {I18n.t('btn_add_sensor')}
                    </Button>
                </form>
            </>
        );
    }
}

// @ts-ignore
export default withStyles(styles)(Settings);