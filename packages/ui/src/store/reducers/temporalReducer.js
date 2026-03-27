// action - state management
import * as actionTypes from '../actions'

export const initialState = {
    isDirty: false,
    workflow: null,
    executionStatus: null,
    agentFlows: [] // List of AgentFlows available for dropdown
}

// ==============================|| TEMPORAL REDUCER ||============================== //

const temporalReducer = (state = initialState, action) => {
    switch (action.type) {
        case actionTypes.SET_TEMPORAL_DIRTY:
            return {
                ...state,
                isDirty: true
            }
        case actionTypes.REMOVE_TEMPORAL_DIRTY:
            return {
                ...state,
                isDirty: false
            }
        case actionTypes.SET_TEMPORAL_WORKFLOW:
            return {
                ...state,
                workflow: action.workflow
            }
        case actionTypes.SET_TEMPORAL_EXECUTION_STATUS:
            return {
                ...state,
                executionStatus: action.status
            }
        case actionTypes.SET_TEMPORAL_AGENTFLOWS:
            return {
                ...state,
                agentFlows: action.agentFlows
            }
        default:
            return state
    }
}

export default temporalReducer
