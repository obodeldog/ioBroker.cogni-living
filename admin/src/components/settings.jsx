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
import IconButton from '@material-ui/core/IconButton';

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
        // Damit ist die Anzeige unabhängig von der Speicher-Geschwindigkeit
        this.state = {
            devices: props.native.devices || []
        };
    }

    /**
     * Aktualisiert sowohl den lokalen State (für die Anzeige)
     * als auch die ioBroker Konfiguration (zum Speichern)
     */
    updateDevices(newDevices) {
        // 1. Sofort lokal anzeigen (damit der Cursor nicht springt)
        this.setState({ devices: newDevices });

        // 2. An ioBroker melden (zum Speichern)
        this.props.onChange('devices', newDevices);
    }

    onAddDevice() {
        // Wir kopieren das Array sicher
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

    render() {
        const { classes } = this.props;
        // WICHTIG: Wir lesen jetzt aus this.state, nicht mehr aus this.props
        const { devices } = this.state;

        return (
            <>
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
                                            <TextField
                                                className={classes.tableInput}
                                                value={device.id}
                                                onChange={(e) =>
                                                    this.onDeviceChange(index, 'id', e.target.value)
                                                }
                                                placeholder="z.B. hm-rpc.0.xxx.STATE"
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