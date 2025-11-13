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
import ListIcon from '@material-ui/icons/List'; // Das Icon für den Auswahl-Button
import IconButton from '@material-ui/core/IconButton';

// WICHTIG: Der ioBroker Objekt-Browser Dialog
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
        // WICHTIG: Wir laden die Daten einmalig in den lokalen "state"
        this.state = {
            devices: props.native.devices || [],
            showSelectId: false, // Ist der Dialog offen?
            selectIdIndex: -1    // Für welche Zeile suchen wir gerade?
        };
    }

    /**
     * Aktualisiert sowohl den lokalen State (für die Anzeige)
     * als auch die ioBroker Konfiguration (zum Speichern)
     */
    updateDevices(newDevices) {
        this.setState({ devices: newDevices });
        this.props.onChange('devices', newDevices);
    }

    onAddDevice() {
        const devices = JSON.parse(JSON.stringify(this.state.devices));
        devices.push({
            id: '',
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

    /**
     * Öffnet den Auswahl-Dialog für eine bestimmte Zeile
     */
    openSelectIdDialog(index) {
        this.setState({
            showSelectId: true,
            selectIdIndex: index
        });
    }

    /**
     * Wird aufgerufen, wenn im Dialog eine ID ausgewählt wurde
     */
    onSelectId(selectedId) {
        if (selectedId && this.state.selectIdIndex !== -1) {
            // Wir schreiben die ausgewählte ID in das Textfeld der gemerkten Zeile
            this.onDeviceChange(this.state.selectIdIndex, 'id', selectedId);
        }
        // Dialog schließen
        this.setState({ showSelectId: false, selectIdIndex: -1 });
    }

    renderSelectIdDialog() {
        if (!this.state.showSelectId) {
            return null;
        }

        // Die aktuell eingetragene ID als Startwert nehmen (falls vorhanden)
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
                                                    placeholder="z.B. hm-rpc.0.xxx.STATE"
                                                />
                                                <IconButton
                                                    size="small"
                                                    onClick={() => this.openSelectIdDialog(index)}
                                                    title="Select ID from Object Browser"
                                                >
                                                    <ListIcon />
                                                </IconButton>
                                            </div>
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